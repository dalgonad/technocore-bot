# Dlicom: Meadow Days

## Game Design Document — v0.1

- **Status:** Design proposal, not an implemented game.
- **Date:** 24 September 2026.
- **Format:** Single-player, 2D top-down cozy farming RPG; keyboard/mouse first.
- **Audience:** Players who enjoy the daily routines, seasonal planning, and village relationships of *Harvest Moon: Back to Nature*.
- **Working title:** Subject to brand approval.

**Playable-build follow-up:** The user's subsequent request added monsters and expanded the map/UI/crops. A standalone browser implementation now lives in [`game/`](../../game/README.md); its README distinguishes implemented systems from the remaining design scope. Optional combat and winter crops in that build intentionally extend the original proposal below.

**Jump to:** [Core loop](#3-core-gameplay-loop) · [Calendar](#7-real-time-clock-weather-and-seasonal-calendar) · [Villagers](#8-five-romanceable-villagers) · [Schedules](#9-daily-schedules-and-tracking) · [Controls](#10-controls-interaction-and-accessibility) · [Asset audit](#supplied-asset-audit-and-use-plan) · [Planting/tool pseudocode](#13-grid-planting-and-tool-switching-pseudocode).

### Design at a glance

You play **Dlino**, a small blue robot who inherits an overgrown farm beside Meadow Village. Grow living things, care for animals, explore the valley, and build a life among five expressive adult robot villagers. Restore the village greenhouse through community projects, not a countdown or mandatory romance.

The emotional promise is **“a little progress, a familiar face, and a reason to look forward to tomorrow.”** Borrow the classic farming-life rhythm, not Harvest Moon's characters, dialogue, maps, music, or distinctive assets. The robot characters and Dlicom-inspired presentation give this proposal its own identity.

| Pillar | Design consequence |
| --- | --- |
| A satisfying daily ritual | Read the forecast, tend crops and animals, choose an outing, return home. |
| A village that feels alive | Residents travel between work, meals, hobbies, and home; their routines are discoverable. |
| Gentle, meaningful choices | Time and stamina create priorities, but there is no debt spiral, animal death, or permanent missable romance. |
| Four seasons of anticipation | Crops, scenery, fishing, birthdays, and festivals change throughout the year. |
| Community before optimization | Friendship and restoration offer progress alongside profit; no single activity or relationship is mandatory. |

## 1. Reference use and boundaries

### Dlicom and the supplied prototype

- **[Dlicom website](https://dlicom.io/):** Reference for brand presentation and community/connection themes. The public website describes a social/Web3 product; this GDD proposes **no wallet connection, token economy, staking, real-money trading, or required online account**. Farm gold is a fictional offline currency.
- **[Dlicom branding board](https://www.figma.com/design/JLmiIppBpTUqUszsvyy5ur/Dlicom-branding?node-id=0-1):** Supplied art-direction reference. The accessible response did not expose a usable board preview or inspectable design tokens. Exact logo, font, spacing, and color rules remain unverified; do not treat the palette below as a confirmed Figma specification.
- **`DLICOM-complete (2).zip`:** Contains a browser-game prototype, not just a branding kit. Its README, JavaScript source, sprite sheets, logo, and historical screenshots were inspected. It was not executed or gameplay-tested for this document.

| Observed in the attached prototype's source | Proposed change for this GDD |
| --- | --- |
| Canvas farming, tools, shipping, fishing, a running clock, and local saves | Retain these concepts; define consistent simulation and save rules below. |
| Dlira, Old Dlito, Dlizal, Dliwi, and Dliyu; gifts and friendship | Retain recognizable names/color identities; add adult romance arcs and authored schedules. Dlito becomes a co-op grower; Dlizal becomes a river warden rather than an arena gatekeeper. |
| Nearby NPC wandering and a simple day counter | Replace with destination-based schedules, four seasons, weekdays, and a relationship journal. |
| A clock advancing one game minute per 0.45 seconds, ending at midnight | Use one game minute per active real second, with bedtime enforced at 02:00. |
| Robot battles, arena progression, and a forest boss | Exclude combat from the cozy core. Dlibot can become an optional non-combat mine guide. |
| A six-slot toolbar with a hand tool and combined action input | Use seven fixed slots and separate interaction from tool use; harvesting needs no hand slot. |

The attachment is reference material, not a commitment to its engine or save format. This deliverable adds a standalone design document; it does not replace the unrelated software in the current repository. All balances and narrative details below are proposed, not observations of the prototype.

## 2. World, goals, and progression

**World layout:** Farm/home at the center-west; village square, bakery, library, workshop, and co-op to the east; pond and forest lake to the south; coast beyond the river; mine and old observatory to the north. Each destination is reachable without crossing a combat zone. Aim for at most 45 active real seconds between the farm and any main village service.

**Starting state:** Spring 1, Monday, Year 1, 06:00; 500 G; eight turnip seeds; 100 maximum stamina; a 10 × 8 plantable field; a working four-place coop with three feed rations but no animals; hoe, watering can, seed pouch, sickle, and axe. Dlizal gives a fishing rod during an introductory meeting; Dliwi lends a pickaxe when the mine opens on Day 3. Both introductions remain available if missed. Core tools cannot be sold or discarded.

**Long-term goal:** Complete four greenhouse restoration projects: a crop pantry, animal-care supplies, a watershed survey, and a mine-powered irrigation pump. Each accepts either its themed collection or an earnable gold contribution, so a disliked activity never blocks the ending. Completing the projects restores a communal ornamental greenhouse, unlocks an epilogue festival, and leaves the farm playable indefinitely. A productive greenhouse is an expansion feature, not assumed in the crop rules below.

| Stage | New possibilities |
| --- | --- |
| First week | Learn farming, meet all five villagers, fish, explore the first mine floors, buy a first chicken. |
| First season | Earn tool upgrades, expand storage, complete an early relationship scene and a restoration contribution. |
| First year | Build a barn, explore deeper mine floors, experience all seasons, optionally date a villager. |
| Continuing play | Finish restoration, complete collections, decorate the farm, and optionally marry. No year-end failure evaluation. |

## 3. Core gameplay loop

```text
Wake up → forecast/calendar → feed and greet animals → tend crops
        → choose an outing: village / fishing / mining / foraging
        → talk, gift, fulfill requests, gather resources
        → return home → cook/craft → ship surplus → sleep
        → settlement, crop growth, animal care, new weather → repeat

Earnings + materials → better tools/buildings → less chore time
                   → more exploration and relationships → new goals
```

**Daily target:** Routine chores take roughly 4–6 active real minutes at an early-game farm size, leaving most of a standard day for one substantial outing. A productive day need not include all four activities.

**Example Spring day (standard speed, five-minute chore routine):** Tend crops and a chicken from 06:00–11:00; reach Dlira's bakery before noon; fish during the early afternoon and deliver a fish to Dlizal at the harbor; take a short late-afternoon mine trip; ship crops and fish; chat at the inn and return to bed by 22:00. The player can skip the mine and spend the afternoon decorating without losing story progress.

### Shared resource rules

- **Stamina:** 100 initially. Hoe 3, water 1, plant 1, sickle 2, axe 4, pickaxe 4, and fishing cast 2. Movement, conversation, petting, harvesting, and refilling the can cost none. Food restores a displayed amount. Failed or invalid tool actions cost nothing; stamina never goes negative.
- **At zero stamina:** Costly actions are disabled; movement, social interaction, harvest, eating, and returning home remain available. Tools do not break.
- **Inventory:** 24 item slots, stacks of 99; quality tiers stack separately. Tools use a separate permanent toolbar. Chests provide storage. A full pack blocks harvest before removing the crop.
- **Shipping:** Eligible goods can be placed in or retrieved from the bin until sleep. Their quoted value settles once during the overnight transition. There is no surprise afternoon pickup deadline. Tools and story items cannot be shipped.
- **Economy:** Fixed, visible prices; no speculation or real-money purchases. Animal feed costs 20 G per ration. Recipes, upgrades, and collection donations create reasons to keep some produce rather than sell everything.

### Progression economy: starting balance

These are concrete starting values for implementation and playtesting, not a claim of a fully balanced economy. Dliwi's public counter takes construction/upgrade orders; pay once at acceptance and complete after the stated overnight transitions. Existing animal housing stays usable during upgrades. Tool upgrades provide a previous-tier loaner until completion. Construction requires a valid, unoccupied footprint; cancellation before the first overnight transition refunds the order.

| Purchase or upgrade | Cost | Nights | Reward / prerequisite |
| --- | --- | --- | --- |
| Storage chest | 300 G + 20 wood | 0 | 48 extra storage slots |
| Coop expansion | 2,500 G + 80 wood + 30 stone | 2 | Increase the starter coop from 4 to 8 places |
| Barn | 4,000 G + 100 wood + 50 stone | 2 | Four cow/sheep places; milking and shearing care kit included |
| Barn expansion | 6,000 G + 160 wood + 100 stone | 3 | Increase an existing barn from 4 to 8 places |
| Field expansion | 3,000 G + 50 wood | 2 | Expand the plantable boundary from 10 × 8 to 20 × 16; new tiles still need clearing |
| Copper tool, per tool | 250 G + 5 copper ore | 1 | Requires that basic tool; hoe/can gain a 3-cell charge, axe/pickaxe gain stronger-node access |
| Iron tool, per tool | 1,000 G + 5 iron ore | 1 | Requires that copper tool; hoe/can gain a 3 × 3 charge, axe/pickaxe gain stronger-node access |
| Silver pickaxe | 2,500 G + 5 silver ore | 1 | Requires iron pickaxe; enables gold nodes |
| House expansion | 5,000 G + 100 wood + 40 stone | 2 | Shared living space; satisfies the marriage housing requirement |

Only hoe, can, axe, and pickaxe use the copper/iron upgrade path; other toolbar items remain functional without upgrades. A basic pickaxe mines stone/copper, copper mines iron, iron mines silver, and silver mines gold. All picks can break ordinary path rocks. The basic axe cuts ordinary trees; copper cuts stumps, and iron cuts large fallen logs.

Charged tools preview eligible cells and spend resources only if the complete preview can be afforded; zero eligible cells means no action or cost. A copper/iron hoe costs `ceil(2 × affected_cells)` / `ceil(1.5 × affected_cells)` stamina; a copper/iron can costs `ceil(0.75 × affected_cells)` / `ceil(0.5 × affected_cells)` stamina and one water charge per affected cell. Tap retains the basic one-cell action. The upgraded can holds 60/90 charges. These area actions extend, rather than silently change, the single-tile pseudocode below.

**Other sale baselines:** Common/uncommon/rare fish sell for 20/45/90 G; each species has a fixed tier and exposes its exact price in the collection journal. Wood and stone sell for 2 G each; copper/iron/silver/gold ore for 15/30/60/100 G; gems for 150 G. Mature trees yield five wood and regrow on designated forest plots after seven nights; breakable rocks yield one stone or one ore according to their visible node type. Farm trees do not regrow under buildings. These are renewable earning/material sources, not finite quest rewards.

| Restoration project | Themed contribution, any quality | Gold alternative | Reward |
| --- | --- | --- | --- |
| Crop pantry | 20 Spring crops + 20 Summer crops + 20 Autumn crops | 4,000 G | Community pantry and two-star compost recipe |
| Animal-care supplies | 12 eggs + 8 milk + 4 wool | 6,000 G | Co-op care station and three-star premium compost recipe |
| Watershed survey | One fish from each of 6 distinct species | 3,000 G | Restored riverside picnic area and habitat notes |
| Irrigation pump | 30 wood + 20 stone + 10 iron ore + 5 gold ore | 5,000 G | Greenhouse pump and decorative water channels |

The village project board accepts either the full themed contribution or the full gold alternative, with identical rewards and no prerequisite friendship level. It tracks collected items without removing them until final confirmation, then commits payment and completion once. All four completions unlock the epilogue. Compost costs three weeds to craft; premium compost costs one compost plus one copper ore. Clearable weeds renew on unfarmed outdoor ground, never over occupied crops or buildings. Gold alternatives let a fishing-focused or farming-focused player finish without owning livestock or reaching the deepest mine floor.

## 4. Farming

### Tile lifecycle

```text
Clear farmland → hoe → tilled soil → plant one seed → water
    → watered overnight growth → seedling → growing → mature
    → harvest → empty tilled soil OR a regrowing plant

Wrong season at dawn → withered plant → clear with sickle → tilled soil
```

- Each logical **32 × 32 pixel cell** holds at most one crop. One seed plants one tile; there are no implicit 3 × 3 seed packets.
- Planting requires valid farm soil, no obstruction, tilling, an empty crop slot, a seed in inventory, the correct season, and enough stamina.
- Water before or after planting: both count for that night. A 30-charge can waters one tile per charge. Refill at a well or accessible water edge; the refill consumes neither money nor stamina.
- Each watered overnight transition contributes **one growth night**, regardless of the time planted. Unwatered crops pause growth without dying. Watering twice cannot accelerate growth or consume a second charge on an already wet tile.
- Rain waters outdoor tilled soil, including soil tilled later that rainy day. Snow does not. At dawn, yesterday's moisture is cleared before today's rain is applied.
- Growth stages are visualizations of saved progress, not timers attached to sprites. Harvesting is free and requires inventory space. Regrowing plants begin their regrowth countdown after harvesting; water already applied that day still counts.
- Crops do not survive outside their allowed seasons, even if mature. The seed preview displays the earliest possible harvest date and warns when it falls beyond the current season. Growth resolves before season rollover cleanup; an incompatible plant still withers at that new dawn.
- Crops are walkable; fences and large obstacles are not. A single tool press cannot accidentally harvest or uproot a healthy plant.

### Initial crop balance

All values are tuning seeds, in G, for one standard-quality item per harvest. “First” means watered nights after sowing; “regrow” means watered nights after a harvest. All listed crops are restricted to their listed season.

| Season | Crop | First | Regrow | Seed | Sell | Purpose |
| --- | --- | --- | --- | --- | --- | --- |
| Spring | Turnip | 4 | — | 20 | 55 | Fast beginner crop |
| Spring | Potato | 6 | — | 40 | 95 | Reliable staple |
| Spring | Cabbage | 8 | — | 60 | 155 | Longer cooking investment |
| Summer | Tomato | 8 | 3 | 70 | 45 | Frequent repeat harvests |
| Summer | Corn | 10 | 4 | 80 | 55 | Repeat harvest and feed recipes |
| Summer | Melon | 12 | — | 120 | 320 | Expensive single harvest |
| Autumn | Carrot | 5 | — | 30 | 75 | Short-season flexibility |
| Autumn | Eggplant | 7 | 3 | 60 | 45 | Repeat harvests |
| Autumn | Pumpkin | 10 | — | 100 | 250 | High-value festival ingredient |

**Winter:** No outdoor crops in the initial release. Livestock, fishing, mining, cooking, foraging, and relationships remain viable. Show a winter preparation tip in late Autumn, without imposing a mandatory stockpile.

**Growth example:** Sow and water a turnip on Spring 1. Four watered nights make it harvestable on Spring 5, not Spring 4. Missing one watering moves the earliest harvest to Spring 6. Eight purchased turnip seeds cost 160 G and yield 440 G: 280 G gross margin before the value of time. Starter seeds are free, so their first sale returns the full 440 G.

**Quality:** Display 1–3 stars with sale multipliers of 1.0/1.25/1.5, rounded down per item. Crops start at one star; one compost application before planting grants two stars, and premium compost unlocked through restoration grants three. Repeated applications do not stack or change growth speed.

## 5. Livestock

Start with the farm's working four-place coop and construct a four-place barn when ready; later upgrades add capacity. Buy animals through the co-op's daytime seed/animal stall. An accepted order reserves a free compatible housing slot immediately, counting pending deliveries, and delivers the animal at the next dawn. Animals have names, affection, fed status, age, and product readiness. Each needs one ration or a day's grazing; mixed-age herds are valid.

| Animal | Purchase | Young stage | Mature product | Standard sale |
| --- | --- | --- | --- | --- |
| Chicken | 800 G | 3 fed nights | One egg per fed night | 45 G |
| Cow | 4,000 G | 7 fed nights | One milk per fed night, collected with contextual milking | 140 G |
| Sheep | 3,000 G | 5 fed nights | One wool per 3 fed nights, collected with contextual shearing | 210 G |

- Pets and brushing build affection; displayed affection thresholds determine product quality: 0–3 hearts = one star, 4–7 = two, 8–10 = three. Use the same sale multipliers as crops.
- Mature, fed animals advance production at dawn. A juvenile that reaches adulthood that dawn begins production on the following night. Pending milk/wool or an uncollected egg is preserved, never overwritten; the next cycle starts after collection and counts that day's feeding.
- Stocking the trough automatically feeds each animal once per day. On clear, non-winter days, an animal outside in a pasture containing grass from 10:00–16:00 can graze instead; the status icon confirms eligibility. Send animals indoors automatically at 18:00.
- Players can leave animals inside in any weather. Rain/snow disables grazing, not animal safety. Feed is sold through an always-accessible co-op supply box, including shop rest days.
- Missing food pauses growth/production and displays a reminder. There is **no animal death, forced sale, or irreversible illness**. No manual minigame is required for milking or shearing; the contextual interaction checks for the barn's included care kit.
- The overnight resolver uses saved daily care flags, not the animal's current animation or scene visibility. Uncollected products and animal state persist across saves.

## 6. Fishing and mining

### Fishing

- Fish at the farm pond, forest lake/river, and coast. Target **12 fish species** across the three habitat groups, with seasonal, weather, and time preferences recorded after discovery.
- Equip the rod, face reachable water, and use the tool to cast for 2 stamina. A bite arrives after approximately 3–8 active real seconds. Show a bobber animation, a clear sound, and an on-screen cue; no color-only signal.
- Press tool-use within a 1.5-second bite window, then hold to reel and release to reduce tension. Land the fish after about 3–6 seconds of controlled reeling. Escape cancels; a missed bite loses no money or inventory.
- Accessibility options extend the bite window to 3 seconds or auto-hook. An assisted reel mode replaces tension management with a single confirmation. These options do not reduce rewards.
- Fishing and the world clock advance together; menus pause both. If the clock reaches 02:00, cancel an unresolved cast before ending the day. A catch whose success event already committed is retained.
- A full pack opens a paused catch tray: keep by freeing space or release. There is no silent deletion, and no new cast until the tray is resolved. Fish can be sold, cooked, gifted, or donated to the watershed survey.

### Mining

- A **20-floor mine**, with copper on floors 1–5, iron on 6–10, silver on 11–15, and gold on 16–20. Stone and occasional gems provide secondary rewards.
- Swing the pickaxe at a reachable rock for 4 stamina per valid hit. Stronger nodes require better tools and show the requirement before use. Unbreakable targets consume no stamina.
- Floors combine authored safe layouts with seeded ore placement. A visible ladder always exists; progress never depends on exhausting every rock to discover an exit. Unlock permanent elevator stops at floors 1, 5, 10, 15, and 20 upon reaching them.
- No mandatory combat, traps, gear loss, or health damage. Darkness is atmospheric; the entrance provides a free lantern. Dlibot's optional guide quest adds hints and personality, not a paid power advantage.
- Ore supports tool upgrades and restoration. Copper/iron tool tiers reduce chores through clearly previewed charge areas; the first playable slice uses single-tile tools only.
- Ore drops that cannot enter the pack remain on the floor and persist until collected or the next daily reset. Warn before leaving a full-pack expedition. Floors reset at dawn, after all occupants have returned home; elevator progress persists.

## 7. Real-time clock, weather, and seasonal calendar

“Real-time” means the clock runs continuously **while gameplay is active**, not that it follows the device's wall clock. There is no offline crop progression or penalty for closing the game.

| Rule | Specification |
| --- | --- |
| Standard speed | 1 active real second = 1 game minute |
| Active day | 06:00 through 02:00 the following morning = 1,200 game minutes = 20 active real minutes |
| Relaxed speed | 0.5 game minutes per active real second = 40 active real minutes per full day |
| Pausing | Dialogue, inventory, shops, journal/map/calendar, pause menu, loading, and lost application focus pause time, NPC movement, and minigames together |
| Unpaused activities | Walking, tool animations, indoor exploration, fishing, and mining |
| Calendar | Spring → Summer → Autumn → Winter; 28 days per season; 112 days per year |
| Weekdays | Seven-day week; every season starts on Monday because 28 is divisible by 7 |
| Day boundary | Midnight remains part of the current farm day; calendar date and daily limits change only during the sleep/dawn transition |
| Sleep | Voluntary sleep advances once to 06:00. Before midnight: 100% stamina; midnight–01:59: 80%; forced return at 02:00: 60% |
| Forced return | Fade home, retain possessions and money, show a gentle reminder; no rescue fee |

**Lighting:** Dawn 06:00–08:00; daytime until seasonal sunset; 90-minute dusk; readable moonlit night after that. Sunset begins at 18:00 in Spring/Autumn, 20:00 in Summer, and 16:30 in Winter. Use warm window lights and a local lantern glow, never an unreadably dark screen. Shops and NPC routines use clock time, not light intensity.

**Weather:** Clear, cloudy, and rainy in Spring–Autumn; clear, cloudy, and snowy in Winter. Rain waters soil and changes outdoor routines. Forecast the next day's weather from the radio at home and the calendar. Persist the forecast and random seed so reloading cannot reroll weather or mine layouts.

### Annual events

Festivals repeat annually and are optional. Standard event hours are 14:00–18:00; named evening events run 18:00–22:00. Time continues at the selected speed, except inside paused conversations. Participants return to their normal routines afterward. If bad weather affects a festival, move it to its authored indoor venue rather than canceling it.

| Season | Day 7 | Day 21 | Seasonal emphasis |
| --- | --- | --- | --- |
| Spring | Seed Exchange | Blossom Picnic | Establish the farm and meet neighbors |
| Summer | River Cleanup & Fishing Fair | Lantern Night (evening) | Fishing, regrowing crops, outdoor dates |
| Autumn | Harvest Potluck | Co-op Market | Cooking, animal goods, winter preparation |
| Winter | Ice Fishing Gathering | Starwatch (evening) | Mine upgrades, stories, warm indoor gatherings |

Birthdays: **Dlira — Spring 12; Dlito — Autumn 5; Dlizal — Summer 16; Dliwi — Winter 9; Dliyu — Autumn 23.** The calendar exposes birthdays after introductions and shows seasonal deadlines, shop rest days, and accepted dates.

### Overnight resolution order

Within one versioned, atomic save transition:

1. Resolve shipping exactly once for the ending day.
2. Apply the ending day's crop moisture and animal-care flags.
3. Increment the absolute day, derive season/day/year/weekday, and apply off-season crop withering.
4. Clear yesterday's moisture and daily talk/gift/care flags; apply the new day's weather to soil.
5. Advance construction/tool orders and resource renewal; deliver due animals into their reserved slots with fresh care flags, without awarding them the previous night's growth or products.
6. Produce the new forecast, reset vacant mine floors, and select NPC schedule overrides.
7. Restore the appropriate stamina, place the player at home at 06:00, and save a recoverable checkpoint.

Store a `last_resolved_day` marker in the same transaction. Retrying a transition after a load must not duplicate money, products, or growth. Early sleep runs exactly one overnight transition, not one growth tick for every skipped hour.

## 8. Five romanceable villagers

The rounded mascot art represents **established adult characters with humanlike emotional lives**. Ages below are proposed narrative biographies, not ages inferred from the supplied images. All five can be befriended without romance and can date a player of any gender. Keep dialogue and presentation clearly adult and avoid turning gifts into transactional consent.

| Villager | Identity and personality | Personal tension and relationship arc | Favorite gifts / birthday |
| --- | --- | --- | --- |
| **Dlira**, 27, she/her — pink baker | Warm, playful, remembers everyone's preferred breakfast; hides exhaustion behind hospitality. | At 2 hearts, help rescue a failed batch. At 4, discover she never takes a day off. Her 6-heart confession is a private picnic; later scenes help her delegate and create a community recipe book. | Strawberry preserves, milk bread; Spring 12 |
| **Dlito**, 44, he/him — green co-op grower | Patient, dry humor, expert in animal care and heirloom seeds; stubborn about accepting help. | At 2 hearts, mend a pasture gate. At 4, learn why he distrusts rapid expansion. At 6, share a quiet pond-side confession; later scenes establish a seed exchange that preserves tradition without excluding newcomers. | Roasted corn, quality wool; Autumn 5 |
| **Dlizal**, 29, he/him — blue river warden | Adventurous, sociable, an enthusiastic but terrible cook; knows every fishing spot. | At 2 hearts, survey the river. At 4, learn he fears being valued only when rescuing others. At 6, choose an unhurried lakeside date; later scenes restore the boathouse and make asking for help part of his identity. | Grilled river fish, vegetable rice balls; Summer 16 |
| **Dliwi**, 28, they/them — yellow engineer | Inventive, direct, distractible; repairs neighbors' tools before their own belongings. | At 2 hearts, test a harmless irrigation prototype. At 4, confront perfectionism after a failed exhibition. At 6, exchange handmade keepsakes; later scenes finish a modest, useful community pump rather than a spectacular machine. | Coffee, copper ore; Winter 9 |
| **Dliyu**, 32, she/her — purple archivist | Observant, quietly mischievous, loves local folklore and astronomy; expresses affection through remembered details. | At 2 hearts, find a missing field journal. At 4, investigate conflicting village histories. At 6, stargaze together; later scenes publish a history that includes ordinary residents and reopen the observatory. | Herbal tea, restored books; Autumn 23 |

All favorite items have repeatable sources. Strawberry preserves and coffee are rotating bakery stock even though strawberries and coffee plants are not launch crops; books come from repeatable restoration requests. No loved gift depends on another romance route.

### Relationship rules

- **0–1,000 relationship points**, displayed as 0–10 hearts, one heart per 100 points. First conversation per day: +8. First gift per day: loved +25, liked +12, neutral +3, disliked +0 with kind preference feedback. Further gifts are declined before item removal.
- Birthday gifts double the ordinary gain, with a maximum of +50, and still use the daily gift limit. A character request grants +40 once per request; event rewards cannot repeat.
- Scenes unlock at **2, 4, 6, 8, and 10 hearts**. The journal gives a location/time hint. Scenes never expire; if the player misses a window, it becomes available again.
- At 6 hearts and after the earlier scenes, an explicit “Ask on a date” choice begins courtship. Declining keeps the friendship path open. The equivalent platonic scene remains available for non-romantic players.
- The romance-coded versions of the scenes in the character table require that opt-in. Without it, the same outing becomes a friendship scene with equivalent story rewards; hearts and gifts alone never change relationship status.
- At 8 hearts, arrange dates with a chosen time window. At 10 hearts, after the personal arc, two dates, and a house expansion, either partner can discuss marriage. Proposal requires an explicit confirmation, not an accidental gift.
- One active romantic partner at a time; ending a relationship is a clear dialogue choice that preserves friendship. No jealousy traps or friendship decay from absence. Marriage adds a shared room, dialogue, and optional meals—not exclusive access to essential upgrades.

## 9. Daily schedules and tracking

### Normal destination windows

These are **destination windows, not teleportation times**. At a window change, a villager starts walking to the listed destination; travel uses part of that window. The map shows “On the way to…” until arrival. NPC shop interactions are available only when the villager has reached the public service point; the journal exposes expected arrival and closing times.

| Villager | 06:00–08:00 | 08:00–12:00 | 12:00–14:00 | 14:00–18:00 | 18:00–22:00 | 22:00–02:00 |
| --- | --- | --- | --- | --- | --- | --- |
| Dlira | Bakery kitchen | Bakery counter | Plaza lunch table | Bakery counter | Inn dining room | Bakery apartment, asleep |
| Dlito | Co-op animal barn | Field-side seed/animal stall | Co-op kitchen | Co-op animal barn | Farm pond, fishing | Co-op farmhouse, asleep |
| Dlizal | Boathouse | Forest lake patrol | Riverside picnic spot | Harbor supply desk | Inn dining room | Boathouse loft, asleep |
| Dliwi | Workshop loft | Workshop counter | Plaza food stall | Mine entrance supply shed | Workshop project bench | Workshop loft, asleep |
| Dliyu | Library archive room | Library desk | Bakery reading table | Old grove ruins | Observatory | Library apartment, asleep |

**Private areas:** Morning preparation rooms and bedrooms are not public by default. The map can say “At home — unavailable” without revealing a precise indoor position. Never let a schedule marker bypass a locked door. Public services end at the scheduled block boundary, even if the NPC is still walking home.

### Weekly and weather exceptions

| Villager | Rest day | Replacement destinations from 08:00–22:00 | Rain/snow fallback for outdoor blocks |
| --- | --- | --- | --- |
| Dlira | Tuesday | 08:00–14:00 orchard; 14:00–18:00 library; 18:00–22:00 inn | Bakery reading table |
| Dlito | Wednesday | 08:00–12:00 forest trail; 12:00–18:00 lake; 18:00–22:00 farmhouse | Co-op animal barn |
| Dlizal | Friday | 08:00–18:00 coast; 18:00–22:00 inn | Boathouse common room |
| Dliwi | Sunday | 08:00–14:00 library; 14:00–18:00 plaza; 18:00–22:00 workshop | Workshop project bench |
| Dliyu | Monday | 08:00–14:00 old grove; 14:00–18:00 bakery; 18:00–22:00 observatory | Library reading room |

Rest-day service counters remain closed even if weather sends the owner back to the building. The feed supply box remains available. Morning and sleeping blocks are unchanged unless an event explicitly overrides them.

### Scheduler and journal behavior

1. Resolve **active scripted scene → festival → accepted date → weekly rest day → normal schedule**. Do not trigger a new heart scene during a festival or an accepted date. Finish an already active scene before changing routes.
2. Apply rain/snow remapping to the selected outdoor destination. Festivals and dates have authored indoor alternatives. If a scene is blocked by weather, retain its availability rather than consuming it.
3. Select a half-open interval, `start <= farm_minute < end`. Represent midnight as minute 1,440 and 02:00 as minute 1,560; the current farm day starts at minute 360. This avoids a midnight schedule reset.
4. Pathfind from the actual position to a named destination anchor. Replan when weather, a door, or an event changes the route. An unreachable destination falls back to a reachable public waiting anchor and retries; no on-screen teleporting or movement through locked doors.
5. On load, restore position and the active event, recompute the current destination, and resume navigation. Off-screen schedules still update; any coarse travel simulation must preserve plausible arrival time.

After an introduction, the **People journal** shows the villager's shared routine, birthday, discovered gift preferences, hearts, today's changes, and next expected stop. The map displays their actual current zone and an in-transit label, not a false marker at the scheduled destination. Pinning a villager draws a route to a public meeting point. Example: **“Dlira — walking to the inn; expected around 18:15. Bakery closed.”**

## 10. Controls, interaction, and accessibility

| Action | Default keyboard/mouse | Behavior |
| --- | --- | --- |
| Move | **W A S D** or arrow keys | Continuous top-down motion with collision; normalized diagonals, four-direction facing |
| Walk/run | Shift | Hold or toggle; running costs no stamina |
| Interact | **E** | Talk, open doors, pet animals, refill, harvest, or confirm an explicitly previewed contextual action |
| Use equipped tool | **Space** or left mouse button | Tap for one adjacent cell; hold/release an upgraded hoe or can for a previewed area; not remote mouse targeting |
| Select tool | **1–7** | 1 Hoe, 2 Watering Can, 3 Seeds, 4 Sickle, 5 Axe, 6 Pickaxe, 7 Fishing Rod |
| Previous / next tool | **Q / R**, or mouse wheel | Cycle owned slots only; fixed numbering never shifts |
| Inventory / seed choice | I | Pause; choose the seed assigned to the Seeds slot |
| People journal / map / calendar | J / M / K | Pause; inspect schedules, pins, dates, and forecasts |
| Back / pause / cancel cast | Escape or right mouse button | Close the active panel, cancel the current fishing interaction, or open pause in the world |

The action prompt resolves a single target: facing NPC or usable object first, then a harvestable crop, then no action. Talk never swings a tool. Gift giving is a deliberate choice within a conversation. Show tool name, water/seed count, stamina cost, and a target outline; invalid targets include a brief reason. The most recent directional key sets facing; default facing is down. Movement is freeform, but tool reach is exactly one orthogonally adjacent tile.

Rebinding, UI scaling, reduced flashes/motion, separate audio sliders, subtitles/cues, and toggle-run are baseline settings. Text and icons accompany weather, quality, heart, and tool colors. A future controller layout maps left stick/D-pad to movement, south button to interact, west button to tool-use, shoulders to cycling, and Start to pause; touch controls are not required for the first release.

## 11. Art, branding, UI, and audio

**Visual direction:** Cozy rural pixel scenery with the supplied rounded robot mascots. Soft grass, warm timber, readable crop silhouettes, and restrained blue/gold UI accents. Use Dlicom's mark on the title screen and selected in-world objects, not as a repeated overlay on every tile. Character color is an identity aid, never the only differentiator.

**Rendering target:** 640 × 400 logical canvas, consistent with the attached prototype; 32-pixel world tiles; approximately 48-pixel-tall overworld characters with a shared feet anchor. Integer scaling and nearest-neighbor filtering for world art; letterbox where needed. Depth-sort actors and tall objects by their feet, with a separate foreground canopy layer. Portraits may retain the source art's higher detail.

| Use | Starting value | Provenance / status |
| --- | --- | --- |
| Primary brand accent | `#316FFF` | Present in the current website CSS; proposed for title/major selection accents, not a verified brand standard |
| Secondary brand accent | `#FFB21D` | Present in the current website CSS; proposed for important rewards |
| Game panel / text | `#1B2233` / `#F3F1E8` | From the supplied prototype's CSS; retain as a readable baseline |
| Softer in-game blue / gold | `#5AB2FF` / `#FFD166` | From the supplied prototype's CSS; use sparingly in HUD elements |
| World greens / warm soil | Authored per season | Proposed new scenery palette, to be approved alongside the full branding board |

The website stylesheet uses **DM Sans**; consider it for scalable menus after font/license verification. Use a legible licensed pixel font for optional small world labels, not long dialogue. Meet readable text contrast rather than assuming any brand-color pairing is accessible.

**HUD:** Upper left: season/day, time, weather, forecast hint. Upper right: gold and stamina with numbers. Bottom: seven fixed tool slots and selected seed/water count. The calendar and People journal are one key away. Dialogue shows portrait, name, concise text, and clear choice focus; the clock visibly pauses. Tutorials teach one action at a time and can be replayed.

**Audio:** Gentle acoustic/synth seasonal themes; lighter percussion during daytime chores; ambient night insects, rain, barn sounds, and distinct material/tool feedback. Crossfade music by location and time. No licensed Harvest Moon music or reconstructed melodies.

### Supplied asset audit and use plan

Archive contents and representative pixels were inspected; ZIP integrity checks passed. That verifies readable files, not visual completeness, usage rights, or a working game.

| Attachment | Confirmed contents | Recommended use / remaining work |
| --- | --- | --- |
| `DLICOM-complete (2).zip` | HTML/JavaScript prototype, packed PNG/WebP sheets, logo, raw art, development tests, and historical screenshots | Reference naming, scale, UI motifs, and reusable concepts. The six embedded original ZIPs are byte-identical to six separately supplied archives; do not import duplicates. Historical screenshots are not evidence of a new implementation. |
| `5_villagers_with_animations.zip` | Five sets of eight 256 × 256 PNG frames, five 1,024 × 512 sheets, five GIFs | The eight frames repeat four unique poses; one facing direction, not a full directional walk set. Use as idle/portrait source and author clean four-direction movement. |
| `5_colored_villagers.zip` | Five RGBA character illustrations, approximately 310–360 × 730–740 | Reference/portrait source for the five color-coded roles. Reframe consistently and clean edge remnants before use. |
| `harvest_moon_pixel_animation_frames.zip` | Sixteen 320 × 308 RGBA farming frames | Alternate source; first four frames match the polished set pixel-for-pixel. Do not count both archives as separate gameplay coverage. |
| `harvest_moon_polished_frames.zip` | Sixteen 320 × 308 RGBA farming frames featuring the blue robot | Preferred farming-action reference. Isolate the actor/tool, remove baked soil or edge fragments as needed, and re-author at the target sprite scale. |
| `planting_pixel_animation_frames_FIXED.zip` | Sixteen 320 × 320 RGBA frames | Planting-action reference; “FIXED” is a filename, not proof of clean framing. Inspect clipping and remove unrelated fragments. |
| `blue_robot_battle_frames_16.zip` | Sixteen 320 × 306 RGBA robot combat/effect frames | Optional Dlibot idle/celebration source only; do not add combat to justify the asset. Give Dlibot and Dlino distinct silhouettes/outfits. |
| `farming_rpg_items_separated.zip` | Sixteen RGBA icons, including hoe, axe, can, seeds, rod, food, gifts, book, and lantern | Repaint/scale consistently for the toolbar and inventory. A pickaxe and sickle icon still need authoring. |

**Missing production art:** Terrain/building/interior tiles, crop growth stages and withered variants, livestock and care animations, fish, mine nodes, weather effects, seasonal variants, four-direction character locomotion, and additional tool poses. The loose action frames supply no timing metadata; choose and test timing rather than assuming a frame rate.

**Import process:** Inventory assets → verify rights → choose canonical sources → clean transparent edges/baked effects → unify palette, silhouette, scale, and feet anchors → author missing directions → export atlases with explicit frame durations and pivots → test in engine. None of the seven standalone art ZIPs contains license/attribution text. Confirm permission for shipped art, logos, and fonts before distribution; the repository's software license does not establish rights to attachments.

## 12. Technical model and save contract

The following model is engine-neutral. Godot or Unity can render it, but scene objects and tile artwork must not be the authoritative save data.

| System | Authoritative data / responsibility |
| --- | --- |
| Clock/calendar | Absolute farm day, farm minute, fractional-minute accumulator, speed, weather/forecast seed, pause state |
| Farm grid | Map ID + integer cell; terrain, obstruction, tilling, moisture, fertilizer quality, optional crop instance |
| Crop definition | Stable ID, allowed seasons, first/regrowth nights, harvest item, stages, prices |
| Crop instance | Definition ID, remaining growth nights, quality, withered flag; zero remaining nights means ready unless withered |
| Player/inventory | World position, cardinal facing, stamina, gold, owned tools/tiers, selected slot/seed, items, shipping bin |
| Animals | Stable ID, type, fed growth nights, affection, today's feed/care flags, production countdown, pending product, reserved delivery slots |
| Villagers | Stable ID, actual position, schedule destination, scene/date state, points, daily talk/gift flags, discovered preferences |
| World/progression | Requests, restoration contributions, construction/tool orders, renewable resource state, elevator stops, mine seed/drops, event completion flags |
| Save coordinator | Schema version, migration, atomic checkpoint, last resolved day, previous recoverable save |

Save at dawn, on explicit save, and on safe scene transitions. Persist random-generator state or deterministic generation seeds; never reroll rewards merely by opening a menu. Resolve or suspend outstanding item transfers before saving. Loading resumes model state without repeating a tool animation's rewards.

The clock accumulates active `delta_seconds × selected_speed`, consumes whole game minutes, and retains the fraction. Process crossed minute events in order, with a single day-end guard. Pause/suspend discards wall-clock elapsed time; returning to focus must not simulate hours of missed frames. Changing day speed must not rescale NPC routes or minigames inconsistently: movement and minigame seconds remain real-time; their available game-time windows follow the clock.

## 13. Grid planting and tool-switching pseudocode

This is an **engine-neutral outline**, not a drop-in Unity/Godot script. It specifies the single-tile farming path; UI, collision, scene rendering, and the non-farming tool handlers are interfaces. Use the engine's grid coordinate conversion if the map is scaled or rotated. For the unrotated, unit-scale grid below, flooring coordinates is essential, including for negative positions.

`require(condition, message)` means **return failure immediately, with no mutation**, if the condition is false. `atomic` means validate and commit synchronously without yielding, callbacks, or partial inventory changes. Animation is presentation only; it must never consume a seed or grant a harvest a second time.

```text
enum Tool { HOE, WATERING_CAN, SEEDS, SICKLE, AXE, PICKAXE, ROD }
slots = [HOE, WATERING_CAN, SEEDS, SICKLE, AXE, PICKAXE, ROD]
selected_slot = 0
selected_seed_id = "turnip"
facing = (0, 1)                       # A cardinal unit vector.
action_busy = false
TILE_SIZE = 32

function target_cell(player_feet_world, grid_origin):
    local = player_feet_world - grid_origin
    standing = (floor(local.x / TILE_SIZE), floor(local.y / TILE_SIZE))
    return standing + facing

function select_slot(index):
    require(world_input_enabled and not action_busy, "Wait for this action")
    require(0 <= index < length(slots), "Invalid slot")
    require(player.owns(slots[index]), "Tool not unlocked")
    selected_slot = index
    refresh_toolbar()

function cycle_tool(direction):
    require(direction in [-1, 1], "Invalid direction")
    require(world_input_enabled and not action_busy, "Wait for this action")
    for offset in 1 .. length(slots):
        index = positive_mod(selected_slot + direction * offset, length(slots))
        if player.owns(slots[index]):
            select_slot(index)
            return

function on_number_key(number):
    select_slot(number - 1)

function try_use_tool():
    require(world_input_enabled and not action_busy, "Cannot act now")
    tool = slots[selected_slot]
    require(player.owns(tool), "Tool not unlocked")
    cell = target_cell(player.feet_world, current_map.grid_origin)

    if tool not in [HOE, WATERING_CAN, SEEDS]:
        # Handlers enforce the same reach, cost, and atomic-commit contract.
        return world_tools.try_use(tool, current_map.id, cell)

    tile = farm_tiles.get((current_map.id, cell))
    require(tile != null and tile.terrain == FARM_SOIL, "Not farm soil")
    require(not world.is_obstructed(current_map.id, cell), "Tile is blocked")

    if tool == HOE:
        require(not tile.tilled and tile.crop == null, "Already occupied or tilled")
        cost = 3
    else if tool == WATERING_CAN:
        require(tile.tilled and not tile.watered, "No dry tilled soil here")
        require(player.water_charges > 0, "Refill your watering can")
        cost = 1
    else if tool == SEEDS:
        definition = crop_definitions.get(selected_seed_id)
        require(definition != null, "Select a seed")
        require(tile.tilled and tile.crop == null, "Hoe an empty tile first")
        require(calendar.season in definition.allowed_seasons, "Wrong season")
        require(inventory.count(definition.seed_item) >= 1, "No seeds left")
        cost = 1

    require(player.stamina >= cost, "Not enough stamina")

    atomic:
        player.stamina -= cost
        if tool == HOE:
            tile.tilled = true
            tile.watered = weather.wets_outdoor_soil
        else if tool == WATERING_CAN:
            player.water_charges -= 1
            tile.watered = true
        else:
            inventory.remove(definition.seed_item, 1)
            tile.crop = CropInstance(
                definition_id = definition.id,
                nights_left = definition.first_growth_nights,
                quality = tile.fertilizer_quality,
                withered = false
            )
            tile.fertilizer_quality = 1
            # Preserve moisture when planting into already-watered soil.
        action_busy = true

    refresh_tile(cell)
    play_tool_animation(tool, cell, on_finished = unlock_actions)

function unlock_actions():
    action_busy = false

function try_harvest(cell):
    require(world_input_enabled and not action_busy, "Cannot act now")
    require(cell == target_cell(player.feet_world, current_map.grid_origin),
            "Out of reach")
    tile = farm_tiles.get((current_map.id, cell))
    require(tile != null and tile.crop != null, "No crop here")
    require(not world.is_obstructed(current_map.id, cell), "Tile is blocked")
    crop = tile.crop
    require(not crop.withered and crop.nights_left == 0, "Not ready")
    definition = crop_definitions[crop.definition_id]
    item = HarvestItem(definition.harvest_item, crop.quality)
    require(inventory.can_add(item, 1), "Backpack full")

    atomic:
        inventory.add(item, 1)
        if definition.regrowth_nights > 0:
            crop.nights_left = definition.regrowth_nights
        else:
            tile.crop = null
        action_busy = true
    refresh_tile(cell)
    play_harvest_animation(cell, on_finished = unlock_actions)

function resolve_farm_overnight(next_season, next_weather):
    # Called once inside the guarded, atomic day-transition transaction.
    for tile in all_saved_farm_tiles:
        crop = tile.crop
        if crop != null and not crop.withered:
            if tile.watered and crop.nights_left > 0:
                crop.nights_left -= 1
            definition = crop_definitions[crop.definition_id]
            if next_season not in definition.allowed_seasons:
                crop.withered = true
        tile.watered = tile.tilled and next_weather.wets_outdoor_soil
```

**Integration contract:** The input router gives UI and contextual interactions priority. For this single-tile outline, it sends only fresh button presses to tool-use, suppresses key-repeat, and maps Q/R or wheel direction to −1/+1. The busy flag locks movement and tool switching for the short action animation; interruption or scene teardown clears that presentation lock without reverting or reapplying the committed model transaction. Core tools remain owned, so cycling always has a valid fallback. A sickle handler removes withered crops or weeds, never a healthy crop without a separate confirmed clearing mode.

For upgraded hoe/can input, enter a charge-preview state instead of immediately calling `try_use_tool`. Lock position, facing, and tool selection during the preview. On release, commit either the single-cell tap or the charged-area transaction, never both. Escape cancels an uncommitted preview without cost. This extension must preserve the same validation, inventory, and action-lock guarantees as the single-tile path.

**Engine scene outline:** `GameRoot` owns clock, calendar, inventory, save coordinator, and definition registries. `World` owns the grid renderer, collision, interactables, NPC navigation, and weather. `Player` owns movement, facing, and the tool controller. `UI` observes state changes; it does not directly edit crop growth. Wire the same logical input actions through either engine's input mapping, rather than checking raw keys throughout gameplay code.

## 14. Scope and acceptance criteria

### Build order

1. **Vertical slice:** Seven Spring days; two crops; one chicken; basic fishing with three fish; five mine floors; all five villagers with weekday/rain schedules, journal tracking, and one introductory relationship scene each. Include the clock, sleep, shipping, inventory, and save/load from the start.
2. **Systems-complete alpha:** All four seasons, nine crops, three livestock types, twelve fish, twenty mine floors, upgrades, weekly exceptions, weather, and all calendar events. Add the full farming art pipeline rather than shipping raw inconsistent frames.
3. **Content-complete beta:** Five relationship routes with five core scenes each, friendship alternatives, dating/marriage, four restoration projects, full save migration/recovery, accessibility, and balance testing.

**Not initial scope:** Multiplayer, blockchain features, combat, procedural story generation, children, rival marriage, real-time offline progression, or productive greenhouse farming. Controller/touch polish and additional crops can follow only after the core loop is stable.

### Verification checklist for implementation

| Area | Acceptance test |
| --- | --- |
| Clock | At standard speed, 60 unpaused real seconds advances exactly 60 game minutes at 30/60/144 FPS; a 60-second pause or background suspension advances none. |
| Calendar | Spring 28 transitions once to Summer 1; Winter 28 to Spring 1 of the next year; midnight alone does not reset gifts or schedules. |
| Grid targeting | Test map offsets and negative coordinates. From local feet `(-1, 16)`, standing cell is `(-1, 0)`, not `(0, 0)`; facing right targets `(0, 0)`. |
| Planting | Valid sowing removes exactly one seed and one stamina; untilled, blocked, occupied, wrong-season, empty-seed, and insufficient-stamina attempts change nothing. |
| Watering/growth | Water before and after planting both count. Duplicate watering costs nothing. Four watered nights produce a turnip; unwatered nights do not advance it. Rain applies to newly tilled soil too. |
| Harvest/regrowth | Full inventory preserves the crop. A harvested tomato becomes ready after three further watered nights, not immediately and not without water. |
| Season edge | A Spring-only crop, including a mature one, withers at Summer 1. The player gets a sowing warning before committing to an impossible in-season harvest. |
| Tool switching | Q/R wraps correctly, skips unowned tools, keeps displayed numbers stable, and cannot change the tool during an action; held use does not spend multiple seeds. |
| Animals | Each animal eats at most once daily. Hungry animals and juveniles produce nothing; adult production, preserved pending products, grazing, and weather behave as specified. |
| Economy/progression | With no other spending, eight starter turnips shipped on Spring 5 give 940 G at Spring 6 dawn; a chicken order then arrives in the starter coop on Spring 7. Orders reserve capacity and charge once; both restoration payment routes grant the same reward once. |
| Fishing/mining | Test cancellation, 02:00 transitions, assisted controls, full-pack catches/drops, unlocked exits, and persistent elevator progress. |
| NPC routines | All five schedules cover 06:00–02:00, rest-day and weather priorities are deterministic, and a moving NPC marker follows actual position rather than its destination. |
| Relationships | Gifts and daily talk cannot be farmed by reloading or crossing midnight. Romance needs consent; missed scenes return; platonic progression remains available. |
| Persistence | Save/load preserves planted seeds, water, regrowth, animals, calendar, random state, NPC position, and relationship flags. Retrying dawn never duplicates shipment income or growth. |
| Presentation | Inspect new in-engine screenshots at day/night and each season; verify readable text, clean sprite edges, consistent anchors, and interaction prompts. Source screenshots do not count. |

### Open approvals, not implementation claims

- Full Figma brand rules and permission to use the Dlicom name/mark.
- Distribution rights for supplied images and any added fonts/audio.
- Final choice of engine and whether any browser-prototype code will be reused; old-save compatibility is not promised by this design.
- Final confirmation of the robot-village narrative and non-combat treatment of the battle assets.

The supplied materials establish a useful visual starting point, but directional animation, world art, the new systems, and the acceptance tests still require implementation.
