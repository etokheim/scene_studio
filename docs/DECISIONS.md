# Decisions

## Domain and repo rename to scene_studio

- **Date:** 2026-09-25
- **Supersedes in part:** “Domain and repo rename to circadian_scenes (v4)” — the domain, folder, panel, store key, Docker names, and GitHub repo are `scene_studio` / **Scene Studio**. Circadian stays the name of the sun-following scene kind.
- **Decision:** Rename from `circadian_scenes` to `scene_studio`. On first load, copy `circadian_scenes.scenes` (or, if that is empty, `scene_extrapolation.scenes`) into `scene_studio.scenes` when the new key is empty. Purge entity-registry rows on both old platforms. Panel `localStorage` falls back through those domains once. Config entries on an old domain do not auto-load — remove the old entry and add Scene Studio once. No dual-domain stub. The next release is a major.
- **Why:** The product is the scene editor, not only circadian scenes. Scene Studio was free as a Home Assistant domain and as `etokheim/scene_studio`. The same words exist for unrelated 3D, video, and photo tools; they do not collide inside Home Assistant.
- **Do not reverse without user ask.**

## Disk focus changes when the pin is released

- **Date:** 2026-09-24
- **Supersedes in part:** “Circadian editor uses one Huemane hue wheel per focused lamp” — a hop no longer restacks the disks while the pointer is down, and the next hop does not wait for an interior visit.
- **Decision:** Crossing from one disk to the next resists by the same inset past the shared edge, including palette. The pin may hop during the drag. The disk stack and which disk is in front stay as they were until the pointer is released. On release, the disk under the pin takes focus and the others animate into the new stack.
- **Why:** Restacking on the way across moved the edges under the pointer, so the resistance only existed for the first hop.
- **Do not reverse without user ask.**

## Theme split and palette mode button

- **Date:** 2026-09-25
- **Supersedes in part:** “Scene base palette is a corner split button, not a preset” — the corner split is the theme. The palette is a mode-pill button.
- **Supersedes in part:** “First column is the scene list; library is a second tab” — the circadian used-items row sits under Play scene live.
- **Decision:** The split button is the scene’s base palette in the simple editor and the base theme in the circadian editor. The name opens that list; the pencil opens the item. Randomize is a shuffle icon on that palette split, not a button in the variable list, and the same icon sits on Randomize in the palette dialog. A simple scene has one base palette (`palette_id`) and may have no theme. A circadian scene always has one theme, and one palette per solar event on `event_palettes`. Chips list the other library items the scene uses: color variables, and on a circadian scene the event palettes. A light pointing at a palette does not add a second base palette. The palette face in the mode pill still switches the disk. With no palette it is a dashed “+” and opens the palette list immediately. With a palette, the first click activates that mode and the next click on the whole button opens the list. The pencil on the active button opens the palette editor. Opening either list from the editor must not mint a scene. A variable, palette, or theme editor lists the scenes that use it as the same chips; choosing one opens that scene.
- **Why:** The corner control was the palette, so the theme had no switcher, and a scene with no palette had no way to pick one from the mode row.
- **Do not reverse without user ask.**

## Scene base palette is a corner split button, not a preset

- **Date:** 2026-09-24
- **Superseded in part:** 2026-09-25 — see “Theme split and palette mode button”. The per-event `event_palettes` field and the color-only preset row stay.
- **Supersedes in part:** “Color/kelvin mode selector matches huemane-light-card” — the bottom-right row is color variables only. Palettes are not hue presets.
- **Supersedes in part:** “Palette variables” — the palette face is not added only when the selected pin already uses a palette.
- **Decision:** The hue-preset track lists color variables only. A scene’s base palette is a split button in the used-items corner (theme and color-variable chips stay). The first half opens the new-scene palette dialog, including None. None is the starting choice when a scene is created with Custom. On an existing scene, None clears that base palette. The second half opens that palette’s editor and is hidden when the base is None. The mode pill lists every disk the wheel can show (color, temperature, and palette when the scene has one). A mode none of the selected lights can use stays in the pill, dimmed, labeled “Not supported”. Brightness-only and on/off selections still replace the disks. Every stacked disk uses the same shadow. A simple scene stores the base on `palette_id` and `assignment_seed`. A circadian scene stores one palette per solar event on `event_palettes`, not on the shared theme and not in `palette_id`. Opening the dialog from the editor must not mint a scene or run the Custom create path.
- **Why:** Palettes were a second kind of preset, and the pill hid disks the user still needed to see. The circadian store had no per-event palette, so the button could not be wired without that field.
- **Do not reverse without user ask.**

## A pin grows only after its dot has been painted

- **Date:** 2026-09-24
- **Decision:** Hover, click, tile selection, and group open/close share one pin grow: the `.pin-body` scale, played backwards on collapse. Add `.expanded` on a frame after the dot is painted. Do not move the pin in the SVG in that same turn. An already-open pin stays put while another dot grows. Group flights use that same duration and curve.
- **Why:** The first hover, and any hover while another pin was open, moved the node in the same turn as the class change, so the scale transition never started. Group open used a different flight.
- **Do not reverse without user ask.**

## RGB-only bulbs skip a palette that mixes kelvin and color

- **Date:** 2026-09-24
- **Supersedes in part:** “Temperature bulbs use a palette disk only when it is all kelvin” — a color bulb no longer joins every palette.
- **Decision:** A bulb that can do both color and kelvin can sit on any palette. An RGB-only bulb joins a palette group and disk unless the palette mixes kelvin and chromatic slots; then it stays in the color group. Temperature-only bulbs still join only an all-kelvin palette.
- **Why:** An RGB-only bulb cannot show the kelvin slots of a mixed disk, the same way a temperature bulb cannot show its chromatic slots.
- **Do not reverse without user ask.**

## Temperature bulbs use a palette disk only when it is all kelvin

- **Date:** 2026-09-24
- **Supersedes in part:** “Palette lights share a named group and the palette disk” — a palette reference no longer puts every linked bulb in that group.
- **Decision:** Color bulbs linked to a palette stay in that palette’s group and on its disk. Temperature-only bulbs join that group only when every palette slot is kelvin. On a mixed palette they stay in the temperature group and on the temperature disk; dragging there stores kelvin and drops the palette link. On/off and brightness bulbs never join a palette group.
- **Why:** A temperature bulb cannot show the RGB parts of a mixed disk, and approximating those parts while dragging hides the palette the other lights are using.
- **Do not reverse without user ask.**

## Palette lights share a named group and the palette disk

- **Date:** 2026-09-24
- **Decision:** A light whose draft references a palette is grouped under that palette’s name, ahead of the color/temperature/white/brightness/on-off groups. Selecting that light shows the palette disk. A color or temperature choice stays on the light it was made for, so the next palette light is not left on the RGB disk. The selection ring is drawn outside the tile and scales with the tile (press and jelly), over the action plates. Pin moves after the first pose glide; a drag still follows the pointer.
- **Why:** Palette lights were filed with their sampled color mode, and a previous disk choice kept them on RGB. The ring lived on the frame while the tile scaled, so it sat flush and stayed still. Pins snapped because a later sync cleared the CSS transition before it could run.
- **Do not reverse without user ask.**


Durable product and architecture choices for Scene Studio.
Agents: do not reverse these without an explicit user request. Supersede entries in the same change set when intentionally changing course.

## First column is the scene list; library is a second tab

- **Date:** 2026-09-24
- **Decision:** The area rail opens on **Scenes**. With a scene selected, the rest of that column fades until the pointer is over the rail; the hover rule has to outrank the fade rule or the rows stay dim. Variables, palettes, and circadian themes share a **Library** tab. Editing a scene lists the theme, palettes, and variables it uses at the top left of the editor, over the corner so the list does not take a row in the editor column. Choosing one opens that item and switches the rail to the tab that lists it, scrolled so the item is in view. On a circadian scene that list is its own row in the dial toolbar, under the time and play controls. The dial time, sun angle, and play control stay on the circadian readout; the readout node is created with the dial (the table chart that used to create it is gone).
- **Superseded in part:** 2026-09-25 — the circadian used-items row sits under Play scene live. See “Theme split and palette mode button”.
- **Why:** The scene list was buried under the library. Used items need a way back to their editors without hunting the column.
- **Do not reverse without user ask.**

## Next-day solar dusk sits after midnight on the 24h clock

- **Date:** 2026-09-09
- **Supersedes:** 2026-08-29 clamp of next-calendar-day dusk to 24:00 (noted under “Earliest dusk time lives on the dusk event dialog”).
- **Decision:** When astral dusk is already on the next calendar day, store it as wall-clock seconds (`solar % 86400`) so the dial/chart marker is in the morning after midnight (e.g. 01:00), not pinned at 24:00. Earliest-dusk still only *delays* a same-day solar dusk before the floor; it does not pull a next-morning dusk back to 22:00. Keep events in solar order (dawn→dusk); do not sort by clock seconds. `current_sun_event_index` unwraps a backward dusk time so sunset→dusk and dusk→dawn use the existing midnight-wrap progress math.
- **Why:** Late-summer dusk after midnight is a real solar time. Clamping to 24:00 made dusk look like end-of-day and skipped the sunset→dusk hour that actually falls after 00:00.
- **Do not reverse without user ask.**

## Light sidebar edits write per-event overrides

- **Date:** 2026-09-09
- **Supersedes in part:** “Edit a light at a solar event; write the native scene” and brightness-graph “same-scene points move in tandem”.
- **Superseded in part:** 2026-09-15 — the dial brightness loop is a cosmetic **linear** polar lerp (same as runtime), not ease-in-out.
- **Decision:** Light-edit drafts are keyed by **solar event id**, not a shared native scene entity. Each graph/wheel point writes `formData.overrides[light][event]`. Native-draft flush skips the circadian entity id. The sidebar brightness graph is a **piecewise-linear** polyline through event knots (same lerp as runtime; midnight wrap split so 24:00 stays on the right edge; fill down to 0%). The dial brightness loop stays a **cosmetic linear** stroke in **polar clock space** (linear seconds around midnight, linear radius) so dusk→dawn follows the rim instead of a Cartesian chord.
- **Why:** After v4, `_eventSceneId` fell back to the one circadian entity for every event, so one draft moved all five handles and `apply_native_drafts` never persisted the look. Per-event overrides are the store model; a shared native scene id is not.
- **Do not reverse without user ask.**

## Dial brightness: radial event buttons + override-style curve

- **Date:** 2026-09-09
- **Supersedes in part:** “Table/list sun path…” mobile events-on-path placement.
- **Superseded in part:** 2026-09-09 — the closed stroke is ease-in-out in polar clock space, not a Cartesian Catmull-Rom through the buttons (that chorded across the dial at dusk→dawn).
- **Superseded in part:** 2026-09-09 — dial brightness loop is a quiet hint (arc ~0.32, fill ≤0.08), not the same 0.88 white as time-override chrome. The stroke is linear in polar clock space (not ease-in-out).
- **Superseded in part:** 2026-09-15 — 00/06/12/18 are regular-weight serif numerals on the old 6h tick tips (those four ticks are gone); the other 20 hourly ticks are 2 viewBox units on mobile and **175% of that on desktop** (2px stroke). Hour numerals are 32px / 48px (≥871px). Brightness 100% is `CLOCK_EVENT_GAP_FROM_PATH_PX` **92px** outside the path. Time-override glow keeps its sweep past 12h (does not flip to the short arc). The dial brightness loop is a **linear** polar lerp (same as runtime), not ease-in-out. In light mode the brightness fill is inverted: black @ 5% at 0% brightness (path), transparent at 100%.
- **Decision:** Solar-event buttons encode brightness radially: **0% on the sun path**, **100% at `CLOCK_EVENT_GAP_FROM_PATH_PX` (92px) outside the path**. Inward is dimmer, outward brighter; do not drag inside the path. The same pixel span is the 100% ring on mobile, so buttons leave the path when brightness > 0; chrome grows if needed so the 100% ring stays on the face. A closed **linear** loop through the buttons (solar order, wrapping dusk→dawn in polar seconds/radius) uses the time-override language: 1px white stroke plus an inward white radial ramp to 0 opacity between the path and the curve. The stroke is **cosmetic** — activation still lerps linearly between event knots. The dial shows the **selected light** when a legend card, planet ring, or light sidebar has selected a `light.*` entity; otherwise **theme** brightness. Dragging a handle writes that subject (theme event brightness, or a per-light per-event override — theme is unchanged while a light is selected). Click still opens the event sidebar; brightness updates only after a **10px** move (same threshold as the brightness graph). Each button’s meta shows **name · time** plus a **percent** line; native `title` tooltips match that and do **not** name a per-event scene (that copy was for picking different native scenes per solar event). When the brightness subject changes (selecting a light, closing the sidebar back to the theme, …), handles, spokes, and the curve ease to the new radii (`CLOCK_BRIGHT_MOVE_MS`); live radial drags snap so the pointer does not lag.
- **Why:** Brightness lived only in the sidebar graph. Putting it on the dial makes the day loop visible next to color rings, and matching the override chrome keeps “white line + fade” as one visual language.
- **Do not reverse without user ask.**

## Stage chrome: background glow vs scrolling column

- **Date:** 2026-09-08
- **Supersedes in part:** “Desktop drawer overlays backgrounds” (horizon reach) and “Use HA’s top app bar” (workspace scrollport).
- **Superseded in part:** 2026-09-15 — simple-scene stage uses the same `.sun-light-clock` padding (40px 0 16px, no extra 16px inset) so the workspace grid lines up with circadian. Color/kelvin wheels (and the tile/palette column under them) cap at **650px** (`max-width` + `min-width: 0` so flex cannot grow to `--dial-face-max`). Stage wheel glow stays near the disk (scale 1.2), not a stage-filling wash.
- **Superseded in part:** 2026-09-16 — simple-scene and library wheels use the same stage face budget as the circadian dial (`min(100%, 86vh, var(--dial-face-max, 86vh))`). Do not cap them at 650px; the light-tile strip is already full-column.
- **Superseded in part:** 2026-09-16 — `.page` is full-width whenever a `.workspace` is shown (same shell as `.page.dial-wide`), not only for circadian dial. Color wheels cap at **650px** and shrink with `--dial-face-max` so they stay above the light tiles (floor **400px**, then the stage scrolls). The circadian dial uses the same fit (floor **600px** on `.sun-light-clock-face`) so tiles are on-screen without a 32px peek. `.stage-col` stays full remaining width; max-width lives on the wheel/dial, not the column. Simple/palette wheels are in-flow (`flex: 0 0 auto`); do not `max-height: 100%` them over the tiles. `.simple-editor-host` sizes to content (`min-height: 100%`) so `.stage-scroll` grows a scrollbar at the floor.
- **Superseded in part:** 2026-09-22 — simple and palette editors fill the stage scrollport. `.simple-editor-host` and `.simple-editor` are `height: 100%`; the wheel region is `flex: 1`. The disk is the leftover above the light-tile strip (`max(400px, min(container, 650px))`, mode row subtracted). The stage scrolls only after that 400px floor. Do not size the host to content (`min-height: 100%` alone); that let the disk push the strip off screen before the floor.
- **Decision:** Workspace `.content` has no top padding. `.stage-col` stays `overflow: visible` and splits into `.stage-bg` (pointer-events none; clock horizon and simple-scene wheel glow) plus `.stage-scroll` (`overflow-y: auto`, `overflow-x: clip`) for the face and light list. Horizon/glow are laid out from the face/wheel center and may paint under the frosted area rail. The app-bar scroller stays `overflow: hidden` while a workspace is shown. Simple-scene and variable/palette wheels share the circadian dial diameter. Circadian themes open `#theme/<id>` on that dial; each solar event stores color **and** brightness on the shared theme (wheel-pin detaches a `variable_ref` on that event only). Theme and scene dial chrome share `_isDialView()` so the landscape year rail, date morph, and sticky “now” reset land in the same places. Editing a theme from a circadian scene keeps that scene’s light rings and list; only `#theme/<id>` uses the single theme-ring preview. Sidebar brightness/color drags still patch the open scene’s lights from the theme draft (per-light overrides keep their stops), paint matching circadian scene cards, and `sync()` the graph handle — do not wait for `_saveSoon` / WS list ramps for those visuals.
- **Why:** Padding plus `overflow: visible` on the stage left a header gap and no middle-column scroll. Putting glow in the same box as `overflow-y: auto` clips bleed (CSS overflow axis quirk). A sibling background layer keeps graphics full-bleed while the list can scroll.
- **Do not reverse without user ask.**

## Desktop drawer overlays backgrounds; dial yields with one FLIP

- **Date:** 2026-09-08
- **Supersedes in part:** “Scene editors use the automation sidebar / bottom sheet” — desktop drawers overlay full-width background graphics, while foreground dial content yields to their width.
- **Decision:** On desktop, keep the workspace and full-panel dial horizon at full width beneath the translucent, blurred drawer. Give only `.stage-col` a final right content gutter so the dial is centered in the unobscured view; animate the dial face from its old bounds to those final bounds with one FLIP translation+scale using the drawer’s curve. The landscape year rail collapses into that same FLIP. Do not animate shell padding, page width/margins, or background geometry. Simple-scene card backgrounds are a deterministic triangle mesh rasterized once to canvas with barycentric color interpolation in linear-light RGB, not stacked radial CSS gradients.
- **Why:** A fully overlaid drawer covered the dial; a shell gutter clipped the background and changed dial geometry before the drawer arrived. Separating foreground content from background reach lets the horizon remain visible under the drawer while the dial continuously moves and scales into the remaining view. CSS has no interoperable native mesh-gradient primitive; a small canvas mesh provides actual two-dimensional interpolation without WebGL contexts or translucent gradient-layer chroma buildup.
- **Do not reverse without user ask.**

## Store owns light snapshots; variables and themes are house-wide (v6)

- **Date:** 2026-09-03
- **Supersedes:** native YAML scenes as the editable database; “use my existing scenes” wizard; Created-scenes tab; `hide_managed_native_scenes`; per-event native scene attributes on the circadian entity.
- **Superseded in part:** 2026-09-09 — variables store color (kelvin or HS/RGB) plus brightness; swatches dim with brightness. Wheel palettes list those variables (with a + to create one from the current color), not static kelvin/hex presets.
- **Why:** Generating five native HA scenes per room was MVP baggage. Area membership plus themes is how new lights pick up a look without re-editing every snapshot. Freeze migration keeps existing rooms pixel-identical instead of guessing theme links.
- **Do not reverse without user ask.**

## Live preview throttle while dragging the color wheel

- **Date:** 2026-09-02
- **Decision:** While dragging a wheel pin, live-preview `light.turn_on` calls are rate-limited to about once per 500 ms with a matching 500 ms transition. Click/preset/final release updates send immediately (no transition). Do not flood HA with per-pointermove service calls.
- **Why:** Instant click updates feel fine; unrestricted drag updates queue up and make lamps lag. Matching transition length keeps motion continuous between throttled samples.
- **Do not reverse without user ask.**

## Domain and repo rename to circadian_scenes (v4)

- **Date:** 2026-09-02
- **Superseded in part:** 2026-09-25 — domain is now `scene_studio`. See “Domain and repo rename to scene_studio”.
- **Decision:** Rename the HA domain, component folder, panel element, store key, Docker names, and public GitHub repo from `scene_extrapolation` to `circadian_scenes` (display name **Circadian Scenes**). Ship as a **major** (4.0.0). On first load, copy `scene_extrapolation.scenes` → `circadian_scenes.scenes` when the new key is empty, purge entity-registry rows still on platform `scene_extrapolation`, and fall back once for panel `localStorage` keys. Config entries on the old domain do **not** auto-load — users remove the old entry and add the integration once. Do not keep a dual-domain stub package.
- **Why:** Display rename alone left the technical identity as “extrapolation”; full rename matches the product and avoids Hue “Dynamic Scenes” collision. One production user accepted a hard break; HACS/repo URL change is expected fallout.
- **Do not reverse without user ask.**

## One config entry; rooms live in a store and sidebar panel

- **Date:** 2026-08-26
- **Decision:** Add Scene Studio once. Extrapolation scenes (rooms) are created and edited in a custom sidebar panel. Config lives in `homeassistant.helpers.storage` (`scene_studio.scenes`), not one config entry per room. Legacy per-room entries are imported into the store, then extra entries are removed.
- **Why:** HA config/options flows cannot be a list-and-detail manager. Repeating “add integration” per room was the tedious setup. Scene entities stay `scene.*`; only the configuration home moved.
- **Do not reverse without user ask.**

## Custom panel uses native HA widgets, not an iframe

- **Date:** 2026-08-26
- **Decision:** Register a built-in custom sidebar panel (`embed_iframe: False`) and build list/create/edit with HA web components (`ha-form`, area/entity selectors).
- **Why:** An iframe cannot host those components. Reinventing pickers would look and behave unlike the rest of HA.
- **Do not reverse without user ask.**

## Panel JS cache-bust via versioned static URL

- **Date:** 2026-08-26
- **Decision:** Serve `frontend/panel.js` from `/api/scene_studio/assets/<manifest version>-<PANEL_ASSET_REV>/panel.js` with `cache_headers=False`. Bump `manifest.json` `version` on release; increment `PANEL_ASSET_REV` in `panel.py` for in-progress frontend changes. After `docker compose restart`, pick it up on the **already-open** HA tab with a **normal** reload (`location.reload()` / user refresh / soft navigate that reloads the document) — not a new Cursor browser tab and not a hard-reload (`ignoreCache`). Soft in-app hash navigation alone often keeps the previously registered `scene-studio-panel` custom element. Before judging UI bugs, confirm the new build is live (e.g. shadow DOM lacks removed markers, or CSS matches the change).
- **Why:** HA caches custom panel modules by URL. Python restarts do not pick up JS if the path is unchanged. Custom elements do not re-define when only the hash route changes, so agents can chase “fixed” layout bugs against a stale class. A hard-reload (or a new tab used as one) can reload the whole Cursor window.
- **Do not reverse without user ask.**

## Panel frontend as ES modules without a bundler

- **Date:** 2026-09-01
- **Decision:** Keep `SceneStudioPanel` in `frontend/panel.js` and split free helpers into sibling ES modules loaded with relative imports (`./color_ui.js`, `./dial_clock.js`, `./editor_session.js`, `./client_solar.js`). The static path registers the whole `frontend/` directory, so imports resolve next to `panel.js`. No bundler/build step.
- **Why:** `panel.js` was too large to navigate. HA already loads the panel as a module (`client_solar.js` proved relative imports work). Splitting by concern keeps behavior identical while making further extraction safer.
- **Do not reverse without user ask.**

## Sticky panel header with bottom border

- **Date:** 2026-08-26
- **Superseded:** 2026-08-26 — use `ha-top-app-bar-fixed` instead of a custom sticky header.
- **Decision:** The sidebar panel header stays pinned (`position: sticky`) and has a visible bottom border while the body scrolls.
- **Why:** Explicit UX request; matches HA’s own app header behavior.
- **Do not reverse without user ask.**

## Use HA’s top app bar; header stays outside the scroll container

- **Date:** 2026-08-26
- **Superseded in part:** 2026-09-01 — `:host` keeps `height: 100vh` as the zero-parent fallback but adds `max-height: 100%` so a definite panel outlet clips the host. Without that, the HA shell and `ha-top-app-bar-fixed` both show vertical scrollbars. Empty-state min-height uses the scrollport (`100%`), not another `100vh` stack. Dial uses `overflow-x: clip` (not `hidden`) with `overflow-y: visible` — `hidden`+`visible` computes Y to `auto` and the dial grew a second scrollbar beside the app bar.
- **Decision:** The sidebar panel uses `ha-top-app-bar-fixed`. Title goes in `slot="title"`. Page content (sun path + form) goes in the default slot, which is the component’s scroll container. List view slots `ha-menu-button`; the editor slots a back button that hash-routes home (do not use `back-button` / `goBack()` — this panel is not HA history). Size the panel `:host` to `100vh` with `max-height: 100%`, and stretch the app bar to `100%` of that host. Do not size the app bar with `100%` of `ha-panel-custom` alone — that host often computes to 0 height, which collapses the bar and clips the page.
- **Why:** A custom sticky header had the wrong bottom-border token and sat inside our own overflow, so it did not pin. HA keeps the bar outside the scrolling region and uses `--app-header-border-bottom`. `ha-top-app-bar-fixed` itself uses `100vh` for the same 0-height parent. Pure `100vh` on the custom element is taller than the panel outlet in some shells (embedded browser / definite parent height), which adds a second scrollbar beside the app bar’s. Separately, CSS’s overflow quirk on the dial (`overflow-x: hidden` forces `overflow-y: auto`) stacked a second vertical bar on the editor.
- **Do not reverse without user ask.**

## Standing on a solar event is 0% of the next transition

- **Date:** 2026-08-26
- **Decision:** Current event is the last whose start is *strictly after* now (`start > seconds`). Wrap-around remaining uses `seconds <= next_start` so an exact next-event time is 100%, not a leftover 86400s. Activation (`scene.py`) and preview share `current_sun_event_index` / `transition_progress_percent`. Out-of-range progress still raises; it is not clamped.
- **Why:** `start >= now` treated “exactly dawn” as still the dusk→dawn wrap. Remaining became 86400s, elapsed went negative, and preview samples on the 5-minute grid (dusk minimum 22:00, fallback dawn) raised “Extrapolation math error 2”.
- **Do not reverse without user ask.**

## Sun-path chart on create/edit

- **Date:** 2026-08-26
- **Superseded in part:** 2026-08-26 — no static vertical grid or event lines; hover shows a second cursor line and a fixed readout.
- **Superseded in part:** 2026-08-26 — Y scale is the location’s annual max elevation; the stroke is darker below the horizon.
- **Superseded in part:** 2026-08-30 — when earliest dusk clamps the scene, path dots / night wedges / chart markers stay at true solar dusk; only the interactive event button moves to the floor, with a smaller disabled ghost at solar and a dashed link between them. Top event cards strike through solar time and show the clamped time beside it. Preview events expose `solar_seconds` when overridden.
- **Decision:** The create/edit screen shows a full-width sun elevation curve for today, with dawn / sunrise / noon / sunset / dusk plotted (icons + times). True solar dusk stays visible when earliest-dusk delays the scene; the active control sits at the clamped time.
- **Why:** Makes the solar events the scenes interpolate between visible instead of abstract form fields. Showing both solar and clamp makes the override obvious without lying about when dusk actually is.
- **Do not reverse without user ask.**

## Sun-path Y scale is annual max; night stroke is darker

- **Date:** 2026-08-26
- **Decision:** The sun chart’s vertical domain is ± this location’s maximum solar elevation (`90° − max(0, |lat| − 23.44)`), expanded only if that day’s samples fall outside. Do not auto-fit to the day’s min/max. The polyline (and fill) uses the day amber above 0° and a darker amber below. Horizon stays drawn as the 0° dashed line.
- **Why:** Auto-fitting put a 5° winter noon at the top of the plot, so a sun that barely clears the horizon looked overhead. A day-relative scale also made June and December incomparable. Darker night stroke makes below-horizon the same curve, not a second series.
- **Do not reverse without user ask.**

## Hover inspects time and brightness in a fixed readout

- **Date:** 2026-08-26
- **Superseded in part:** 2026-08-26 — brightness % is appended to each light’s graph name; the readout has no lamp list or color swatch.
- **Superseded in part:** 2026-08-26 — today’s now indicator is one overlay through the sun and light plots (same span as the hover cursor), not a segment in each SVG.
- **Superseded in part:** 2026-08-29 — idle readout always shows wall-clock now + sun elevation on the selected preview date (never “Hover a graph…”); an open solar-event sidebar still pins the readout to that event.
- **Decision:** Sun and light graphs have no static vertical grid or event drop-lines. Today still draws the “now” line. Hovering any plot shows a second full-height cursor. Time and sun elevation update in a readout **above** the plots — not a tooltip that follows the pointer. Each light name on its graph shows the brightness at the cursor (or at now when not hovering).
- **Why:** Hour/event verticals competed with the now line. A follow-cursor tooltip covers the curves you are reading. Putting % on the name keeps the value next to the curve it belongs to.
- **Do not reverse without user ask.**

## Per-light brightness curves and date preview

- **Date:** 2026-08-26
- **Superseded in part:** 2026-08-27 — still one full-width row per light with the name on the plot, but Y is not brightness (see “Light brightness darkens the band”).
- **Superseded:** 2026-09-16 — per-event “Add to …” / light-warn on light tiles and table rows is gone. Membership is whole-scene (tile / sidebar). Sidebar graph `+` can still seed a missing event from peers.
- **Superseded in part:** 2026-08-29 — with an area selected, lights in that area that are in none of the assigned scenes appear as compact suggested rows (`Add to scenes`). Lights that are in the scenes but not in the area keep their graphs and use the warning color on the name. No area → no suggestions and no out-of-area mark. Preview `area` uses `lights_in_area` (entity area, else device).
- **Superseded in part:** 2026-08-29 — a toolbar toggle can wrap the same light samples into concentric 24-hour rings. See “Light graphs: stacked bands or a 24-hour clock”.
- **Superseded in part:** 2026-08-29 — an unassigned solar event is an off-knot in the preview: every lamp is off there (graphs go dark), not skipped so neighbors interpolate across it.
- **Decision:** Under the sun chart on create/edit, list each light as a full-width brightness polyline (one SVG path + x-gradient from sample colors), not a strip of `<rect>` bars. The entity name sits on the chart and opens more-info. Graphs stack with no gap. Polar / no-rise events use the same seasonal fallbacks as scene activation. An entity present in one scene but not the next is a warning, not an error (treated as off during that transition).
- **Why:** A single line matches the sun chart and stays readable. Skipping unassigned events hid that a scene was still needed; treating them as off makes the gap obvious.
- **Do not reverse without user ask.**

## Day transition percent is linear across the five scenes

- **Date:** 2026-08-26
- **Decision:** Replace `transition_modifier` (−100…100 clock shift toward noon/dawn/dusk) with `transition_percent` (0–100 along the day). Knots are equal 25% steps: dawn 0, sunrise 25, noon 50, sunset 75, dusk 100. Manual service values use that mapping directly (intra-segment blend is linear in percent, not in clock time). Auto follows the clock within each pair, then maps onto the same 0–100 scale. After dusk until the next dawn the attribute stays 100 (dusk is the last scene of the day); lights still interpolate dusk→dawn on the clock. A second attribute `transition_percent_manual` is true only when the last `scene_studio.turn_on` included `transition_percent`. Omitting the field (or using native `scene.turn_on`) returns to auto.
- **Why:** A relative time shift was not a readable “where in the day” control. Equal percent steps make 50% always noon regardless of season.
- **Do not reverse without user ask.**

## Solar event row is the scene picker

- **Date:** 2026-08-26
- **Superseded in part:** 2026-08-26 — area is chosen before create and again on save; dusk minimum lives on the dusk event dialog; only nightlights stay on `ha-form`.
- **Superseded in part:** 2026-09-01 — nightlights `ha-form` sits under the light list in the sun-path body (dial: same 500px max-width as the legend; table: full plot width), not in the separate `.content` column.
- **Superseded:** 2026-09-01 — nightlights boolean/scene handling removed (UI, store fields, activate early-return). Prefer a user script/automation to choose an alternate scene.

## Editor and list titles use HA friendly_name

- **Date:** 2026-09-01
- **Decision:** Extrapolation list rows and delete confirm prefer `hass.states[entity_id].attributes.friendly_name`, falling back to stored `scene_name`. The app-bar title is the integration name except on narrow layouts with a back button (scene or theme editor), where it is that scene/theme name.
- **Why:** Rename / registry edits update the entity name; the store copy can lag. Desktop already has the scene in the rail; repeating it in the header hid the integration name.
- **Superseded in part:** 2026-09-09 — wide layouts always show “Scene Studio”; mobile editors keep the selected name beside Back.
- **Do not reverse without user ask.**
- **Superseded in part:** 2026-08-26 — event and light editors use the automation-style sidebar, not a centered `ha-dialog`.
- **Superseded in part:** 2026-08-26 — picker / dusk / link changes apply to the graphs immediately. Close keeps them; there is no Done. YAML is still only written on Save of the extrapolation scene.
- **Superseded in part:** 2026-08-26 — linked dawn/sunrise/sunset is only described in the event sidebar; the row does not outline linked events. Unassigned events use a warning treatment. Buttons cap width and space evenly.
- **Superseded in part:** 2026-08-29 — the event sidebar can create, rename, delete, and clear the native scene. See “Create native scenes from the event picker”.
- **Superseded in part:** 2026-08-29 — the open sidebar’s solar event is highlighted (`aria-current`); clicking that same event again closes the drawer. Still do not outline the linked dawn/sunrise/sunset group.
- **Decision:** Dawn / sunrise / noon / sunset / dusk above the chart are the scene inputs. Clicking one opens a dialog with a native scene picker. Dawn, sunrise, and sunset can share one scene via “Same scene for dawn, sunrise, and sunset”. Scene entity pickers and the combine boolean are not on `ha-form`.
- **Why:** The chart already lists those events. Duplicate pickers below the graph were the same decision twice. Linking lives on the event you are assigning, not a separate toggle.
- **Do not reverse without user ask.**

## Edit a light at a solar event; write the native scene

- **Date:** 2026-08-26
- **Superseded in part:** 2026-08-26 — the editor is an automation-style sidebar, not a centered modal.
- **Superseded in part:** 2026-08-26 — drafts update the graphs immediately; YAML is still written only on Save.
- **Superseded in part:** 2026-08-30 — wheel path / runtime / preview use the same rule: same color kind → channel lerp; different kinds → RGB-lerp endpoints (no 50% mode flip). Still no straight chord across the wheel for same-kind HS paths; hue is not wrapped.
- **Superseded in part:** 2026-09-01 — chromatic HS/RGB pairs use hue+sat rim lerp (see “Smooth cross-mode color blends”); temp / rgbw / rgbww still RGB-lerp across kinds.
- **Superseded in part:** 2026-08-29 — native create/rename/delete, light-edit changes, and removing a lamp from the graphs are session drafts. The extrapolation Save writes YAML. Undo/redo matches the automation editor (`UndoRedoController`: shallow full-session snapshots, 75 steps, commit before each discrete change, Ctrl/Cmd+Z / Shift+Z / Y). An X on each light row removes that lamp from every assigned native scene.
- **Superseded in part:** 2026-08-29 — creating a native scene writes `scenes.yaml` immediately so Home Assistant can resolve the entity in the picker. Rename / delete stay session drafts. See “Create native scenes from the event picker”.
- **Superseded in part:** 2026-08-29 — session drafts also persist in `localStorage` (per HA user + scene, including `#new`). Leaving the editor no longer discards them. Reloading that scene restores the draft and shows a banner; Discard returns to the last saved server copy. A draft whose stored baseline no longer matches the server is dropped, not applied (existing scenes only; `#new` restore rules in “Buffer unsaved edits in local storage”). Light-edit sidebar edits join the session immediately (no nested Save). See “Buffer unsaved edits in local storage”.
- **Superseded in part:** 2026-08-27 — pencils are small shadowed 5px dots on a 40px hit. Hover grows one circle (the action layer) from that center; do not scale the 5px disc (it stacked on `ha-icon-button` and drifted). The next row’s faded incoming edge does not capture pointers, or the first hover only hits the uncovered half of the 40px box. Click the opaque band (`.light-bar-hit`, below the feather) to edit the closest assigned scene; more-info is on the sidebar, not the name. The SVG is not a hit target (`pointer-events: none`) so the band click reaches the hit layer — not the first row through pass-through.
- **Superseded in part:** 2026-08-30 — the light-edit sidebar information button opens more-info **settings** (`view: "settings"`), not the default entity info view.
- **Superseded in part:** 2026-08-27 — the sidebar lists each unique native scene once (compact solar-event-style chips), not one row per solar event. Subtitle names the YAML scene. The save hint (info icon) sits in the footer so it stays put while the wheel scrolls. Close / back / hash change does not discard light edits (they are already session drafts). Opening the sidebar does not overlay the charts until the user edits.
- **Superseded in part:** 2026-09-09 — dual-capable lights show color and kelvin wheels stacked. All-color pins: large color disk, thin kelvin peek ring. All-kelvin: the reverse. Mixed pins: smaller color disk on a thicker kelvin ring with no gap between them. The front disk casts a large shadow onto the back wheel. Drag a pin onto the peeking wheel to convert only that pin (stack expands or swaps). After a swap, the next convert waits until the pointer has entered the new wheel’s interior — the pointer is still on the outer rim, which is now the other peek. No under-wheel color/kelvin mode buttons. Single-mode hardware still gets one disk. Variable chips still apply to the active pin.
- **Superseded in part:** 2026-09-09 — mixed overlap: kelvin ring width is 25% of the previous mixed band (75% of that band goes to the color disk, ~90.5% inner radius). Peek stacks (all-color / all-kelvin) are unchanged.
- **Superseded in part:** 2026-09-09 — mixed kelvin ring is doubled from that thin band (~19% of radius, color disk ~81%).
- **Superseded in part:** 2026-09-23 — on a full kelvin disk (every light is kelvin, so the color wheel sits behind it), a drop keeps that pin’s horizontal offset. Temperature still comes from the vertical position. An outer kelvin ring still rests on the band centerline.
- **Superseded in part:** 2026-08-27 — color and temperature use a Huemane-style wheel (teardrop pin = selected scene, dots = the others; click a dot to focus it). A polyline samples the same RGB / HS / kelvin lerp as runtime, in solar-event order including dusk→dawn. Do not draw a straight chord: RGB lerp bows through lower saturation. Hue is not wrapped (same as `extrapolate_hs`). Preset swatches stay on one row and scroll sideways; a right-edge fade shows when more colors sit off-screen. Switching unique scenes does not prompt. Edits write every touched native scene for that lamp into the editor session as you go; the extrapolation Save writes YAML.
- **Superseded in part:** 2026-09-01 — wheel path drawing is cosmetic denser sampling of the same lerp (default 72 steps; near-constant-sat HS uses ~2.5° chords; sat-varying HS under/mid strokes use Catmull-Rom cubics). Smoothness ≠ a different blend space; cross-mode still RGB-lerps (bows toward white). Hue still not wrapped.
- **Superseded in part:** 2026-09-01 — chromatic HS/RGB pairs (incl. mixed) lerp hue+sat on the rim; wheel chrome sits 16px below the disk (flex gap, not overlapping absolute). Temp↔color and rgbw/rgbww still RGB-lerp. Hue still not wrapped.
- **Superseded in part:** 2026-08-29 — above the wheel, a brightness graph shows one point per assigned solar event (X = event time, Y = brightness). Titled “Brightness” with “0–100% by solar event” subtext; plot is full-bleed (no side axis labels). Dragging a member point updates draft brightness; pointerup/cancel on `window` ends the drag even outside the SVG. Events where this lamp is not yet in the scene show a `+` at brightness 0; clicking `+` adds the lamp. Clicking a member point focuses that scene like a wheel dot.
- **Superseded in part:** 2026-09-08 — light-sidebar chips are one solar event each (icon + name), not unique native-scene names. Switching compares event id so shared circadian entity ids still change the focused knot. Graph `active` follows the open event.
- **Superseded in part:** 2026-08-30 — brightness graph keeps a fixed 120px height and fills the sidebar width by resizing the SVG viewBox (circles stay round; no `preserveAspectRatio: none` stretch). Same-scene graph points still move in tandem via the shared draft. Membership resolves from the assigned scene id with an event-row fallback. Footer copy says “light”, not “lamp”. Unavailable (orphaned) native scene entities are treated as unassigned so the dial/light sidebar do not show empty membership for a friendly name that is no longer loadable; overlay drafts can still materialize a stub scene when adding a light. The light-edit sidebar has no separate On/Brightness fields — brightness is edited only via the graph (and color via the wheel).
- **Superseded in part:** 2026-09-01 — brightness-graph event labels keep handle dots on true time; colliding names stagger onto a second row (then nudge horizontally) so dawn/sunrise and sunset/dusk stay readable in a narrow sidebar.
- **Superseded in part:** 2026-08-29 — Live edit is a header toggle (editor session), not a per-sidebar switch. While a light sidebar is open it applies/restores that lamp; closing the drawer still restores the open-time snapshot.
- **Superseded in part:** 2026-09-01 — live `light.turn_on` sends exactly one Color descriptors field (rgbww → rgbw → hs → rgb → kelvin). Drafts/snapshots often hold hs+rgb together; HA rejects that exclusion group.
- **Superseded in part:** 2026-09-09 — mode buttons under the wheel are gone; drag-to-peek converts one pin. Native YAML still stores `color_mode` + exactly one color attr.
- **Decision:** Each light timeline has a pencil per solar event. The dialog edits that lamp’s **stored** state in the native YAML scene for that event, not the live entity. Sidebar edits commit to the editor session (preview overlay) as they happen; the extrapolation Save writes `scenes.yaml` once. Optional **Live edit** (header) applies the current scene’s draft to the lamp only while the dialog is open; closing restores the lamp to the snapshot taken on open.
- **Why:** Tuning a circadian scene by watching the interpolated chart is faster than opening five HA scene editors. A nested Save fought the global Save mental model. Live edit is opt-in so walking around the house is not required. Restoring on close avoids leaving the room stuck in a draft. Dawn/sunrise/sunset often share one YAML scene, so listing solar events twice was the same target twice.
- **Do not reverse without user ask.**

## Scene editors use the automation sidebar / bottom sheet

- **Date:** 2026-08-26
- **Superseded in part:** 2026-08-26 — desktop open/close is a 200ms transform-only slide (`cubic-bezier(0.2, 0, 0, 1)`). Do not transition `.page` max-width — that reflows the graphs every frame.
- **Superseded in part:** 2026-08-27 — opening the drawer pads `.page-shell` by the gutter (sidebar width + 16px, matching the drawer’s right inset — no extra gap) and moves the Save button with `--scene-sidebar-gutter`, same 200ms curve as the slide. The 1024px column recenters in the remaining space. Do not animate `max-width`. A second editor reuses the open drawer and fades body/footer; it does not close and re-slide. Draft + location-override banners share `.page-banners` with one `margin-inline: 16px` so dial view (zero page padding) stays inset without doubling against a gutter gap.
- **Superseded in part:** 2026-09-08 — `.page-banners` mounts into `.stage-col` (above `.stage-scroll`) so they only span the main column and push the dial/list down. The area rail stays full height. Park back onto `.page` when there is no stage (narrow circadian). Face budget uses the scrollport top below the banners.
- **Decision:** Pencil (light at a solar event) and solar-event scene assignment open an automation-style editor: a right-hand outlined `ha-card` with `ha-dialog-header` on wide viewports (375px, 2px `--primary-color` border), and `ha-bottom-sheet` when `narrow` or `(max-width: 870px), (max-height: 500px)`. Reduced-motion uses 1ms. Do not use `ha-automation-sidebar` / `ha-automation-sidebar-card` / `ha-resizable-bottom-sheet` — those stay unregistered until the automation editor chunk loads. Save / Rename / area / delete stay centered `ha-dialog`s.
- **Why:** The chart should stay visible while tuning a lamp or assigning a scene, the same split as Settings → Automations. Custom panels cannot import the automation-only elements.
- **Do not reverse without user ask.**

## Page column is 1024px (table) / 1920px (dial)

- **Date:** 2026-08-26
- **Superseded:** 2026-08-27 — restore `--page-max-width: 1024px`. Matching `manual-automation-editor` (1540px) made the charts full-bleed on a typical laptop and put the overlay drawer on top of the graphs.
- **Superseded in part:** 2026-08-27 — the open drawer pads the editor shell so the 1024px column sits in the remaining space. Width stays 1024px when it still fits.
- **Superseded:** 2026-08-29 — widen to `--page-max-width: 1920px` so the dial can stay centered while the year timeline pins to the absolute right edge.
- **Superseded in part:** 2026-08-29 — dial view uses 1920px (`.page.dial-wide`); list and table view stay at 1024px.
- **Decision:** `.page` defaults to a centered 1024px column with 12px inline padding. Dial (clock) view adds `.dial-wide` for 1920px so the year timeline can pin to the absolute right without shifting the dial. Do not use `--ha-automation-editor-width`, and do not grow max-width when the drawer opens.
- **Why:** Stacked light bands stay readable at 1024px; the dial needs a wider canvas for a right-edge scrub without offsetting the face.
- **Do not reverse without user ask.**

## Legacy per-room entries migrate; this is not a breaking reconfigure

- **Date:** 2026-08-26
- **Decision:** Treat the sidebar/store move as a **minor** (2.2.x), not a major. On setup, each old config entry is imported into `scene_studio.scenes` using its `unique_id`, extra entries are removed, and scene entities keep that unique id. Users do not re-pick rooms or native scenes. The options flow is gone; editing happens in the sidebar. Mark 🚨 / major only if unique ids, service fields, or stored keys become incompatible without a migrator.
- **Why:** The configuration home moved; the data did not. A major would force a fake reconfigure on the only production user and on anyone who upgrades through HACS.
- **Do not reverse without user ask.**

## Native HA date field for the preview day

- **Date:** 2026-08-26
- **Superseded in part:** 2026-08-29 — visible control is a day/month label above the year scrub (calendar icon affordance); click calls `ha-date-input._openDialog()` on the mounted `ha-selector` `{ date: {} }` (kept opacity-0 / non-interactive). Today / 21 Jun / 21 Dec chips sit on the same row as the date in table view (date first), and to the left of the date in dial view (stacked above the date in the landscape rail).
- **Decision:** The preview day control is HA’s `ha-selector` `{ date: {} }` (`ha-date-input` → `ha-dialog-date-picker`), presented as a day/month label. Do not use Activity’s `ha-date-range-picker` (that is a start–end range) or a raw `<input type="date">`.
- **Why:** Logbook’s widget is a range. The single-day native widget is `ha-date-input`. `ha-selector` already knows how to lazy-load that chunk from HA’s bundle; our `panel.js` cannot `import()` those files.
- **Do not reverse without user ask.**

## Year scrubber under the preview date

- **Date:** 2026-08-26
- **Superseded in part:** 2026-08-29 — on landscape devices in clock view the scrubber is a vertical rail absolutely positioned to the right of the clock face (30px gap; does not shift the centered face); collapsing the rail animates width with the sidebar dock; portrait and stacked/table view keep the horizontal strip under the date row; landscape + open scene sidebar collapses the scrubber.
- **Superseded in part:** 2026-08-29 — landscape clock rail pins to the absolute right of the stage (not beside the face); day/month label sits above the scrub in that rail (and above the horizontal scrub in portrait/table).
- **Superseded in part:** 2026-09-01 — portrait dial toolbar is in-flow (time/sun + date chips in a wrapping `.sun-toolbar-chrome`, year scrub below) so the timeline pushes the dial down instead of covering ticks; horizon glow still bleeds behind via full-host `_layoutClockHorizonBack`. Landscape rail only when `min-width: 900px` (narrow/square landscape kept the empty left gutter as a black bar).
- **Superseded in part:** 2026-08-29 — landscape dial uses a 3-column grid: matching left gutter + dial + timeline so the timeline takes layout width (dial shrinks) while the dial stays optically centered; event buttons/labels sit in a fixed-px chrome band around an inset dial core so they stay readable as the dial scales. The landscape rail pads its bottom when the Save FAB would cover the scrub track.
- **Superseded in part:** 2026-08-30 — landscape dial rail: date chips use `width: 100%` + `justify-content: flex-end` (nowrap) so the right edge stays in the rail and overflow grows left into the dial; do not use `width: max-content` + `margin-left: auto` (that left-aligns when chips are wider than the rail and spills off-screen). Day/month is 26px with no calendar icon.
- **Superseded in part:** 2026-08-30 — dial year scrub no longer waits on a per-day HA `preview` mid-drag. While dragging in dial view, the panel builds that day’s sun geometry in the browser (SunCalc + seasonal fallbacks, dusk minimum applied), resamples light rings from existing `event_states`, and patches the dial in place. On pointer-up, one authoritative `DOMAIN/preview` (executor) reconciles Astral times and exact samples. Scene activation stays on HA `solar.py` only — client math is scrub UX, not runtime. Table view still debounces preview while dragging.
- **Superseded in part:** 2026-09-01 — portrait dial toolbar is in-flow (time/sun + date chips share a wrapping `.sun-toolbar-chrome`; year scrub below) so the timeline pushes the dial down instead of covering ticks; horizon glow still bleeds behind via full-host `_layoutClockHorizonBack`. Landscape rail requires `min-width: 900px` so narrow/square landscape does not leave an empty left gutter as a black bar. Chrome readout uses higher-specificity static positioning (absolute dial readout was overlapping chips); reset sits in a fixed 32px slot. Mobile `overflow-x: clip` stays on page/dial-wide only — not stage/body/clock — so horizon-back cannot inflate scroll height below the light list; page pad under the list is 156px.
- **Superseded in part:** 2026-09-02 — `overflow-x: clip` on `.page-shell` / `.page.dial-wide` applies at all widths (not only ≤870px). Desktop still widened `ha-top-app-bar`’s `.ha-scrollbar` via `.clock-horizon-back`. Sidebar-docked no longer clears that clip on the shell (path/stage/body/clock stay `overflow: visible` for chips).
- **Superseded in part:** 2026-09-03 — with a persistent area rail, `.clock-horizon-back` stays clipped to `.stage-col`. The rail is an opaque independent scrollport; the app-bar scroller is locked while a `.workspace` is shown so the list does not scroll under the dial wash.
- **Superseded in part:** 2026-09-08 — the area rail overlays dial horizon (`z-index` above `.clock-horizon-back`) with a frosted `backdrop-filter` so the wash reads through. Horizon is sized to the host again (not clipped to `.stage-col`). The rail is its own scrollport (`overflow-y: auto`); the app-bar scroller stays locked while a `.workspace` is shown.
- **Decision:** Show a custom year timeline (month labels + draggable thumb) for the year of the selected preview day, with the selected day/month above it. Pointer drag/click maps to calendar days; keyboard arrows / Home / End work on the slider. Do not use `<input type="range">` — it cannot host month ticks. Keep the toolbar/scrub block as a stable sibling of the chart body so `replaceChildren` on preview redraw cannot drop pointer capture or focus. While dragging in dial view, update the thumb, day/month label, and dial from client sun math (no mid-drag websocket); on release, fetch HA preview once. Cache recent full payloads by chart key for idle redraws.
- **Why:** Jumping between solstices with chips is coarse; the calendar picker is precise but slow for seasonal comparison. A year strip is the missing middle. Re-inserting the scrubber on every preview cancelled the drag. A matching left gutter keeps the dial centered without overlaying the timeline on the face. Per-day HA preview mid-drag serialized updates to ~one frame per RTT; client geometry keeps the dial continuous through the year.
- **Do not reverse without user ask.**

## Preview location override is session-only and quiet until used

- **Date:** 2026-08-26
- **Superseded in part:** 2026-08-27 — the location dialog has a search field (Photon geocoder) above HA’s map picker. The map still commits lat/lng; search only jumps the pin.
- **Superseded in part:** 2026-08-29 — idle map-marker control lives in the app-bar action items (with the dial/table toggle), not on the date row.
- **Decision:** Create/edit can override the coordinates used for the sun path and light graphs. Idle state is a map-marker icon in the editor header. Once a place other than Home Assistant’s configured lat/lng is applied, a warning-styled banner shows the coordinates, with Change and reset. The override is panel session state (not stored on the scene). Clock, “today”, and the now line stay on Home Assistant’s timezone — same as `scene_studio.turn_on`’s location field. Use HA’s `{ location: { radius: false } }` selector, not a custom map.
- **Why:** Polar / far-south sun times are the reason to preview another date; another latitude is the matching test. A always-visible map would crowd the date tools. Radius is unused for solar events. HA’s location selector has no search box of its own.
- **Do not reverse without user ask.**

## Opaque light-graph fills

- **Date:** 2026-08-26
- **Superseded:** 2026-08-27 — no area-under-curve; brightness darkens a full-height color band.
- **Decision:** The area under each light brightness polyline is fully opaque (`fill-opacity: 1`). Keep the stroke on top of the fill.
- **Why:** Semi-transparent fills made the curves look washed out against the card background.
- **Do not reverse without user ask.**

## Light-graph color wash is independent of brightness

- **Date:** 2026-08-26
- **Superseded:** 2026-08-27 — brightness *is* the darkening of the color band.
- **Decision:** Each light row paints the same horizontal color gradient as a full-height rect at `fill-opacity: 0.5`, then the brightness-shaped area at `fill-opacity: 1`. Y-axis stays brightness. The stroke stays on top.
- **Why:** A dim or off stretch still has a color. Clipping color to the brightness fill hid warm/cool shifts when the curve sat near the baseline.
- **Do not reverse without user ask.**

## Light brightness darkens the band; rows feather

- **Date:** 2026-08-27
- **Superseded in part:** 2026-08-27 — hovering the stack shortens the incoming-edge fade to 1px, but the opaque start stays at 36px. Tightening the fade from the top of the 108px bar revealed the overlap and made rows look taller. Last row keeps the full 108px bar so its visible band matches the others. Names, dots, and warnings sit on the visible band, not the faded overlap. Edit dots use `scale` on the 5px circle (parent hit box is centered with negative margin, not `translate(-50%, -50%)`).
- **Superseded in part:** 2026-08-29 — hover brightens the band; the open light-edit lamp gets a primary glow. Clicks use an opaque-only hit layer so lower bands no longer fall through to the first row.
- **Superseded in part:** 2026-08-29 — `--light-feather` / `--clock-feather` / `--ring-expand` / `--ring-border-w` are registered with `CSS.registerProperty` on the document (shadow `@property` does not enable transitions). `--ring-expand` / `--ring-border-w` use `inherits: true` so the hover/selected `::after` rim mask and the fill child see the same values (non-inherited registration left the rim at 0 width). Transition feather on `.sun-lights` / `.sun-light-clock-rings`; expand/border on each `.clock-ring`. Ring fill uses a masked child so hover/selected `::after` rim borders are not clipped by the fill mask; selected rings keep the sharp feather (`:has(.selected)`), not only hover.
- **Superseded in part:** 2026-08-30 — dial ring hover/selected use a stronger black `drop-shadow` (blur 28px / 12px, 2× prior) and a white `::after` rim at 6% opacity (no scale grow); rim width is a fixed `1px` (`--ring-rim-w`) painted just inside the band edges so the outermost ring is not clipped at 100%. Soft ↔ sharp feather/expand snaps with no transition (animating the ramp looked like a size morph). Sibling rings dim to 50% over a surface-colored disc (`--primary-background-color`) so they don’t mix with horizon/bloom (dim selector is `:not(.hovered):not(.selected)` so the active band stays fully opaque — a blanket `.clock-ring { opacity: 0.5 }` outranked the active `opacity: 1`). Only one band is highlighted at a time: while `.hovered` is set on another ring, `.selected:not(.hovered)` yields the rim/shadow and dims like siblings until the pointer leaves the planet. Switching the open light sets `_sidebarLightId` (ring `.selected`) **before** awaiting the sidebar pane swap so clearing hover cannot re-light the previous band. Clicking outside the rings (and outside legend/event/sidebar chrome) closes the light sidebar and clears selection. Soft mode keeps `--clock-feather` plus `--ring-soft-expand` (~1.35× feather) so opaque cores overlap and the surface never shows through seams; sharp mode (hover/selected host) zeros both so bands sit edge-to-edge. Hovering a ring shows its friendly name in a pill flush above the outer light ring (anchored to the rings inset in the core). Clicking the already-selected ring closes the light sidebar and clears selection. Touch/pen on the rings uses pointer capture + `touch-action: none` (and non-passive `touchmove` preventDefault) so scrubbing bands does not scroll the page.
- **Superseded in part:** 2026-08-30 — dial ring hover/selected use `scale(1.05)`, a black `drop-shadow`, and dim sibling rings to 50% opacity (no primary `::after` rim).
- **Superseded in part:** 2026-08-30 — dial ring hover/selected use a small radial grow (~0.45%) and the same sharp primary `::after` rim; no `drop-shadow` glow on the selected band.
- **Decision:** Each light is a full-height horizontal color band. Sample RGB is multiplied by brightness/100 (off is black). Middle and last rows are 108px; the first is 72px (no incoming overlap). Rows overlap by 36px. Only the incoming top is masked; the row underneath stays opaque so the dark card cannot show through the seam. First top stays opaque. No `filter: blur()`, no brightness polyline. Hover % on the name stays.
- **Why:** A Y-axis sparkline plus a separate color wash made stacked lamps read as separate charts. Darkening keeps hue and level on one surface. Fading both edges left two ~50% layers over the card, so blend zones went dark.
- **Do not reverse without user ask.**

## Panel FAB matches hass-subpage, not ha-fab

- **Date:** 2026-08-26
- **Superseded in part:** 2026-08-30 — editor Save FAB appears only while the session is dirty; fades/scales with `.is-hidden` (not UA `[hidden]` display:none) so show/hide matches HA fab motion. New scenes open the save dialog; existing scenes save immediately. Name / area / metadata edits go through overflow → Rename/settings.
- **Superseded in part:** 2026-08-30 — Save FAB is always shown on `#new` (create is unsaved until the first successful save, even when the post-wizard form matches the session baseline). Existing scenes still show Save only while dirty.
- **Superseded in part:** 2026-09-09 — no Save FAB and no Variables & themes FAB (library is a rail section). List/editor FAB is unused; edits autosave.
- **Decision:** List and editor use a corner overlay (`position: absolute` sibling of `ha-top-app-bar-fixed`, same offsets as hass-subpage `#fab`) with `ha-button size="l" variant="brand" appearance="accent"` when a FAB is shown. Do not use `ha-fab` — it is not registered in this frontend.
- **Why:** Automations create with that button in the `#fab` slot. `ha-top-app-bar-fixed` has no fab slot, so the overlay has to sit beside the app bar. Hiding a clean Save matches HA’s dirty-only create/save pattern.
- **Do not reverse without user ask.**

## Save/rename dialog; area stays on the form

- **Date:** 2026-08-26
- **Superseded:** 2026-09-22 — rename does not offer an area picker. The scene stays on the area it was created in. Icon, category, and labels are the rename fields. See “Scene tiles, create menu, and rename”.
- **Superseded:** 2026-08-26 — area is required in a dialog before create, then shown again on Save/Rename.
- **Superseded in part:** 2026-08-30 — first Save on a new scene opens the dialog (name/area/metadata); later Saves write immediately. Rename/settings still open the dialog from the overflow menu.
- **Decision:** Save (first create) and Rename open a `ha-dialog` patterned on `ha-dialog-automation-save`: required name, area, optional description / category / labels via assist chips. Name is not a form field. Persist description in the store; sync labels and the `scene` category through the entity registry.
- **Why:** HA scene/automation save prompts for identity metadata at create/rename time. Repeat Save should not re-ask. `ha-dialog-scene-save` is not loaded in a custom panel.
- **Do not reverse without user ask.**

## Prompt for area before a new scene; area also on Save

- **Date:** 2026-08-26
- **Superseded:** 2026-09-22 — area is chosen by which area’s plus button created the scene. Rename does not change it. See “Scene tiles, create menu, and rename”.
- **Superseded in part:** 2026-08-30 — area is still collected on first Save / Rename; subsequent Saves skip the dialog.
- **Superseded in part:** 2026-08-30 — create dialog is a wizard: area + Automatic / Manual cards; Manual adds a second step with solar-event scene pickers (linked dawn/sunrise/sunset on by default; empty slots = Automatic). Areas with no lights are rejected with an error. See “Create wizard sets up native scenes”.
- **Decision:** **New extrapolation scene** opens an area dialog first. Continue navigates to `#new` with that area already set (refresh of `#new` with no area prompts again; cancel returns to the list). First Save and Rename show the area selector, prefilled. Area is not on `ha-form`. Native scene pickers still filter by the working area.
- **Why:** Area is the room identity and the filter for native scenes. Asking once up front avoids an empty editor; Rename keeps a path to change it later without interrupting every Save.
- **Do not reverse without user ask.**

## Create wizard sets up native scenes

- **Date:** 2026-08-30
- **Superseded in part:** 2026-09-01 — auto-created native scene names are `{area} {Event}` (Dawn, Sunrise, Noon, Sunset, Dusk). The combined dawn/sunrise/sunset slot is `{area} Dawn-Sunset` (not Bright / Dimmed / Low lights).
- **Decision:** New-scene wizard offers **Set up automatically** (one native scene per solar event) or **Use my existing scenes** (manual picks). Copy mirrors the old config-flow step descriptions (native scenes only; empty slot = create automatically). Manual step uses `ha-selector` entity pickers (not custom `<select>`), with field helpers from the old `data_description`s. Manual pre-fills from area native scenes by average light brightness: brightest → noon, second → linked day, lowest → dusk. Creates name `{area} {Event}`; combined day slot `{area} Dawn-Sunset` (sunset light profile). Batch create via `apply_area_setup` (one YAML reload).
- **Why:** Most rooms need a sensible first draft; power users want to wire existing HA scenes without leaving the flow. Event-named scenes match the dial; Bright/Dimmed/Low described brightness, not which solar event they belonged to.
- **Do not reverse without user ask.**

## Earliest dusk is a house-wide setting

- **Date:** 2026-09-08
- **Supersedes:** “Earliest dusk time lives on the dusk event dialog” (2026-08-26).
- **Decision:** `dusk_minimum_time_of_day` is an integration setting (seconds since midnight, default 22:00). Activation, preview, theme dial, and table/dial ghost+clamp visualization all use that one floor. Edit it in Settings and as the **last item in the scrollable body** of the light / theme-event sidebar while dusk is the open event (hidden for other events; not in the sticky action footer). Per-scene `scene_dusk_minimum_time_of_day` is lifted into settings on load and dropped. Solar-event buttons open the theme-event sidebar (color, brightness, variables) for the scene’s theme or the theme being edited; a banner names the theme and warns that edits apply to every circadian scene still using it. Per-light overrides stay. Ring clicks still open per-light edit on a scene, and the same theme-event sidebar on a theme.
- **Why:** The floor is about when dusk is allowed to happen in the house, not a property of one room scene. Event buttons are the place to inspect that solar event; Settings is the house-wide copy of the same control.
- **Do not reverse without user ask.**

## Earliest dusk time lives on the dusk event dialog

- **Date:** 2026-08-26
- **Superseded in part:** 2026-08-29 — earliest dusk only delays a same-day solar dusk; if solar dusk is already past midnight of that calendar day, keep end-of-day (24:00) and do not pull back to the floor (shared `dusk_start_seconds` in preview and activation).
- **Superseded:** 2026-09-09 — next-calendar-day solar dusk is placed after midnight on the 24h clock (`solar % 86400`), not clamped to 24:00. Earliest-dusk still does not pull that dusk back to the floor. See “Next-day solar dusk sits after midnight on the 24h clock”.
- **Superseded:** 2026-09-08 — earliest dusk is a house-wide setting (`dusk_minimum_time_of_day`), not a per-scene field. See “Earliest dusk is a house-wide setting”.
- **Decision:** `scene_dusk_minimum_time_of_day` is edited in the dusk solar-event dialog, next to that event’s scene picker. It is not on `ha-form`.
- **Why:** The override only applies to dusk. Putting it on the main form made it look like a global setting.
- **Do not reverse without user ask.**

## Create native scenes from the event picker

- **Date:** 2026-08-29
- **Superseded in part:** 2026-08-29 — create writes YAML and reloads immediately. A draft id (`scene.__se_draft_*`) is not a Home Assistant entity, so `ha-selector` errors. Rename / delete stay in the editor session until the extrapolation Save.
- **Superseded in part:** 2026-08-30 — clear uses the entity picker’s built-in clear (`ha-selector` `required: false`); an information button beside the picker opens that scene’s more-info **settings** view.
- **Superseded in part:** 2026-09-01 — auto-created names are `{area} {Event}`; combined dawn/sunrise/sunset is `{area} Dawn-Sunset` (still uses the sunset “Dimmed” light profile).
- **Decision:** The solar-event sidebar can create a native YAML scene for the working area, rename or delete the selected one, and clear the assignment via the native entity picker’s clear control (optional `ha-selector`). An `mdi:information-outline` button beside the picker opens `hass-more-info` with `view: "settings"` for the selected scene. Create is disabled without an area. Create walks every enabled light in that area (entity area, else device area) and writes on + brightness + color for the event: `color_temp_kelvin` when the lamp supports color temp (or rgbww / `min_color_temp_kelvin`), otherwise HS from the same kelvin. Linked dawn / sunrise / sunset uses the sunset light profile and the name “{area} Dawn-Sunset”. Other creates use “{area} {Event}”. Profiles: dawn 40%/2700K, sunrise 75%/3500K, noon 100%/4500K, sunset 70%/3000K, dusk 25%/2200K. Create writes `scenes.yaml`, reloads, and sets the new scene’s area before the picker binds. Rename / delete stay in the editor session (preview overlay); the extrapolation Save writes those later.
- **Why:** Building the native scenes in Home Assistant is the tedious part. The event you are assigning is the place to create the matching room scene. The native scene picker can only show entities Home Assistant already knows. Reusing the picker’s clear avoids a duplicate X control.
- **Do not reverse without user ask.**

## Editor undo/redo matches the automation editor

- **Date:** 2026-08-29
- **Superseded in part:** 2026-08-29 — leaving with a dirty session writes `localStorage` and does not prompt. See “Buffer unsaved edits in local storage”.
- **Decision:** Edits write immediately (debounced ~250ms): native YAML via `apply_native_drafts`, the store scene via `save`, themes via `save_theme`. There is no Save FAB. Undo/redo is one global stack (limit 75) across all scenes and themes, available on the list with no scene selected. Each entry stores before/after session snapshots plus the view target and sidebar focus; undo/redo navigates there and reopens that sidebar. Commit the previous snapshot before each discrete change. Shortcuts: Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl/Cmd+Y (skip input / textarea / select / contenteditable). Creating a native scene still writes YAML immediately (undo only unassigns it).
- **Superseded in part:** 2026-09-23 — simple-scene light, color, and level edits commit onto that same stack (a drag or scroll is one entry). Undo and redo open the scene, variable, palette, or theme the entry belongs to when it is not already on screen.
- **Why:** Immediate save keeps cards and other scenes in sync while you edit. Global undo is the replacement for a Save/Discard buffer.
- **Superseded in part:** 2026-09-09 — no extrapolation Save button; stacks are not cleared when leaving a scene; list/theme/narrow editor show undo in the app bar.
- **Do not reverse without user ask.**

## Buffer unsaved edits in local storage

- **Date:** 2026-08-29
- **Superseded in part:** 2026-08-30 — leaving the editor with an unsaved new scene or a dirty existing session prompts Keep editing / Discard (same dialog as draft discard). Discard clears the local draft; Keep cancels navigation. `localStorage` buffering remains for refresh / remount.
- **Superseded in part:** 2026-09-01 — `#new` restore must not compare the stored baseline to the post-refresh empty form (there is no server entity). Reapply `session` and reinstall `baseline` from the buffer so Discard / dirty match the pre-refresh session; only drop when session ≡ baseline. Existing scenes still drop when the stored baseline no longer matches the loaded server form.
- **Superseded in part:** 2026-09-09 — edits autosave; the restore banner and `localStorage` session buffer are removed. Hide/leave flushes `_saveNow`.
- **Why:** Autosave and global undo replaced the browser buffer. Old `localStorage` draft keys are cleared on save/delete if they still exist.
- **Do not reverse without user ask.**

## Editor overflow menu for rename and delete

- **Date:** 2026-08-26
- **Superseded:** 2026-08-26 — reuse the native scene editor overflow on create and edit.
- **Decision:** Existing scenes get `ha-dropdown` in `slot="actionItems"` (dots trigger, `wa-select`, Rename + danger Delete). New unsaved scenes have no overflow. Inline Save/Delete buttons on the form are gone.
- **Why:** Same header overflow pattern as the automation editor. Delete is destructive, so it stays off the FAB.
- **Do not reverse without user ask.**

## Light graphs: stacked bands or a 24-hour clock

- **Date:** 2026-08-29
- **Superseded in part:** 2026-08-29 — the light-edit sidebar includes a horizontal brightness graph above the color wheel: one point per assigned solar event (Y = brightness, fill = that lamp’s color along the day). Non-members show `+` (click to add); members drag. Linked dawn/sunrise/sunset share a draft, so those points stay synced. See “Edit a light at a solar event; write the native scene”.
- **Superseded in part:** 2026-09-16 — brightness-graph `+` (peer-typical add) is gone. A missing event is a dashed handle; click selects that event. Membership is light tiles / sidebar Remove.
- **Superseded in part:** 2026-08-29 — clock glow is sky-from-elevation (not outer-ring conic); sun marker is a CSS disc+flare (not `mdi:weather-sunny`); hover scrubs sun position, sky glow, and the time/elevation readout while light rings stay the full-day preview.
- **Superseded in part:** 2026-08-29 — no dashed horizon circle on the clock; the outer ring edge remains the geometric horizon for the sun path.
- **Superseded in part:** 2026-08-29 — sun path strokes are 0.5px day / 0.25px night with `vector-effect: non-scaling-stroke` (viewBox units were scaling thicker than CSS px); hour labels sit outside the ticks at 8px.
- **Superseded in part:** 2026-08-29 — no now-hand or hover ray on the clock (the sun is the time indicator); hover intro eases the sun to the pointer (~320ms) then tracks live.
- **Superseded in part:** 2026-08-29 — sun hover motion lerps time-of-day along the elevation arc (exponential chase); no CSS left/top tween.
- **Superseded in part:** 2026-08-29 — with a solar event selected, hover/touch still updates the readout but does not move the sun (it stays on that event).
- **Superseded in part:** 2026-08-29 — sun marker follows the drawn path (no horizon pull); scale stays 2× for all elev<0 and at 0°, then eases to 1× as daytime elevation rises; sun-path stroke is min below the horizon, max at the horizon, tapering to min at daytime peak; daytime tint from `skyLookFromElevation` (night strokes stay neutral); round dashed stroke (`8 7`) at 50% opacity painted as continuous path runs; hour ticks sit just outside the planet rim; no area-fill under the linear sun curve; clock enter plays once per editor visit (reset when returning to the list; date/scene redraws skip it); adding a missing light commits undo before writing the draft.
- **Superseded in part:** 2026-08-29 — sun marker uses its own radial track, inset toward the core vs the dashed stroke (night goes deeper under the planet); below the horizon the disc keeps the horizon palette (glow still follows night).
- **Superseded in part:** 2026-08-29 — clock solar-event markers get a 0.5px dashed spoke to the horizon and upright name · time + scene labels immediately above the icon (screen-space, not radial); sunrise/sunset labels sit below the icon so they do not collide with dawn/dusk.
- **Superseded in part:** 2026-08-29 — view toggle is a single app-bar button labeled `Table view` / `Dial view` (destination); location pin shares the header.
- **Superseded in part:** 2026-08-30 — on narrow, location preview and Table/Dial view move into the overflow menu (with undo/redo); Live edit stays in the app bar. Wide layouts keep the header buttons.
- **Superseded in part:** 2026-09-16 — circadian edit is always the dial. Table/list light bars and the Table/Dial overflow toggle are removed.
- **Superseded in part:** 2026-08-29 — dial orientation: midnight at the bottom, noon at the top (`_clockAngleDeg` +180°; light rings `conic-gradient(from 180deg)`). Library theme chips use the same `from 180deg` conic, with dusk→dawn wrapping the night arc (not equal pie slices) and a slightly oversized background so color reaches the rim.
- **Superseded in part:** 2026-09-09 — sky *fills* stay at the half-prior mixes (day wedge `dayAlpha * 0.5`, night 36% / deep 39%). Day/night *glow* is `.clock-horizon-glow` opacity: 15% away from the horizon, full through civil twilight (±6°) so the gold→pink sunrise/sunset ramp is not dimmed. Mixed-mode kelvin pins rest on the annulus centerline, not the inner rim.
- **Superseded in part:** 2026-08-29 — horizon glow + solar-event shadow (wedges/rays/spokes) paint in a back layer that bleeds past the face (not clipped to the planet); night sun disc is **black**; sun is ~⅓ prior size with a center→tip hour handle gapping through it; dial hour labels 10px / 14px (≥871px); 15-minute ticks (2px majors at 6h, 1px otherwise); canvas allows touch pan — only sun/handle use `touch-action: none`.
- **Superseded in part:** 2026-08-30 — hour labels are HTML (fixed 10/14px, not SVG text); tick strokes stay CSS-px via `vector-effect: non-scaling-stroke`; labels every 2h; ticks every 7.5 minutes (still 2px only at 6h).
- **Superseded in part:** 2026-08-30 — sun rides the drawn path radius (no inset marker track); scale is 2× from sunset→sunrise then eases to 1× at zenith (grows again toward sunset); sunset→sunrise night wedges are darker.
- **Superseded in part:** 2026-08-30 — dial horizon backgrounds size to the full panel (under an open sidebar); in-flow dial still uses the sidebar gutter. Sticky scrub draws a gold rim arc from wall-clock now to the override with an inward gold glow.
- **Superseded in part:** 2026-09-01 — horizon reach is remeasured through the sidebar gutter padding transition (ResizeObserver only sees face size, not the left shift), so bloom/sky keep filling the panel under the open drawer.
- **Superseded in part:** 2026-08-30 — dial scrub is magnetic around solar events (animate-in snap, rubber-band pull-away, animate release to the cursor); click the sun or the readout restore button to clear sticky and return to now; night path floor stays outside the light-ring planet at max sun scale.
- **Superseded in part:** 2026-08-30 — sun is a solid white disc (black below horizon) with glow + large blur shadow under the handle; path is fixed-width solid by day and brighter dashed by night; solar-event dots sit on the path with spokes to them; night path keeps its elevation shape and is shifted outward so path and sun clear the planet.
- **Superseded in part:** 2026-08-30 — path uses smooth elev→radius (no night offset-blend warp) so the oval stays clean; 1px non-scaling stroke; sun fill is day-wedge clipped again (HTML outline + glow); 3px plain event dots; chrome ~56px so event buttons sit outside a smaller core; magnet rubber-band only resists (same direction) then eases to the cursor; wider horizon ramp plus a farther sky-color wash.
- **Superseded in part:** 2026-08-30 — sun path is a perfect circle midway between the light-ring planet and the dial-core edge; sticky override arc is white with a short, low-opacity white–gold inward ramp; sun fill + glow are solid white / day-wedge clipped (outline only below horizon); sky behind the dial uses `--card-background-color` instead of an elevation wash.
- **Superseded in part:** 2026-08-30 — circular path radius scales with the day's peak vs annual max (summer larger, winter smaller), clamped with padding between planet and face; snap windows at 60% of prior; ticks/labels white @ 60%; dial center hole filled; override stroke 1px with a slightly stronger gold wash.
- **Superseded in part:** 2026-08-30 — day sun stays pure white (HTML shadow only below horizon so it does not cover the SVG fill); path max radius 90% of the padded face limit; face ~86vh; chrome ~78px with event buttons slightly past the face edge.
- **Superseded in part:** 2026-08-30 — sticky scrub persists across date/location changes; event chrome scales down on small faces (buttons stay inside the face; spokes retarget to buttons); sky wash is an elevation radial again; ticks at every labeled hour with quieter opacity; SVG shadow under a day-clipped glow+fill group (glow 3.3× radius).
- **Superseded in part:** 2026-08-30 — programmatic sun moves (event pin / reset) ease along the path; dragging while an event sidebar is open keeps the drawer open until pointer-up.
- **Superseded in part:** 2026-08-30 — sky wash uses outer sky blues (not white mid/pathColor); sun shadow softened and kept inside a stronger warm glow halo.
- **Superseded in part:** 2026-08-30 — sun arc easing is quintic ease-out; sky palette follows Solar-face mockups (periwinkle day, muted peach horizon — no hot pink).
- **Superseded in part:** 2026-08-30 — dial scrub snaps only on pointer-up (no mid-drag magnet / rubber-band); capture window +30%; snap eases 1s with the same quintic ease-out as event pin; draft banner + portrait date tools stack above horizon bleed; dial sky glow restored to master spread (scale 1.35 / blur 81px / opacity ≤0.55); hourly ticks with master divider/secondary strokes; hour labels inside the marks at 16px / 32px (≥871px).
- **Superseded in part:** 2026-08-30 — sunset→sunrise night wedges use near-black shades with a slight blue tint (not deep navy).
- **Superseded in part:** 2026-08-30 — hour labels outside the ticks (white @ ~40%); hourly ticks 3px / 4px major (white @ ~28% / ~50%), slightly shorter; light-ring glow sits on the face (master blur/scale) with uncapped elevation opacity.
- **Superseded in part:** 2026-08-30 — dial chrome order (outer → inner): hour tick tips on the face edge with numbers just inside the tips (same tick lengths as before), then solar-event buttons, then the inset dial core (path/planet). Chrome inset grows if needed so event buttons stay outside the core.
- **Superseded in part:** 2026-08-30 — hour numbers clear the inward tick stroke (past major length + ~half glyph); solar-event buttons sit at sun-path radius + 10 core-viewBox units (fixed gap as the path scales); sticky override arc/glow maps to the outer tip of the face hour ticks (not a fixed core r=94); chrome inset is driven by ticks/labels only.
- **Superseded in part:** 2026-09-08 — desktop solar-event buttons sit twice as far from the sun-path circle (`CLOCK_EVENT_GAP_FROM_PATH_PX` 56px; chrome floor 80px so labels still fit). The gap is screen pixels, not core viewBox units, so a narrower viewport does not collapse the margin while the path still scales with the season. Mobile (≤870px) still places events on the path.
- **Superseded in part:** 2026-08-30 — dial light list layout is its own decision (under the face; never shrink `--dial-face-max`; left gutter stays empty).
- **Superseded in part:** 2026-08-30 — light-ring glow is core-sized (scale 1.75 / blur 96px / screen blend, opacity ≥0.85); no sky wash; no solid sunrise/sunset rays; dashed sun path only on night arcs; horizon rim band ~2.5h; event path dots 6px; snap capture +25% (~19.5 min).
- **Superseded in part:** 2026-08-30 — light-ring glow has no blur and no screen blend (hard disc, opacity ≥0.85) so the elevation tint is visible behind the rings.
- **Superseded in part:** 2026-08-30 — programmatic sun moves (event pin / reset / release snap) use doubled ease durations (760ms default, 840ms reset, 2s snap).
- **Superseded in part:** 2026-08-30 — light-ring glow is an annular halo sized to the rings (transparent center, bright rim, scale 1.45, no blur): a filled disc under opaque rings was invisible once blur was removed. Event label placement is positional collision handling (top above; bottom below; left/right topmost above, rest below), not hardcoded sunrise/sunset.
- **Superseded in part:** 2026-08-30 — light-ring glow is two staged dial clones (scales 2.76 + 1.38, each `blur(28px)`, opacity 0.815) in a face-level layer above the horizon wash; `translateZ(0)` compositor layers on bloom / rings / horizon / overlays so scrub does not re-rasterize static filters; planet shadow is `box-shadow` (not `filter: drop-shadow`); sun keeps the soft CSS-blur halo (`blur(2.5px)`) and shadow (`blur(6px)`), with halo stop opacities 20% less transparent than the prior ramp. Day sector (sunrise→sunset) fills with Apple Solar–style sky blue (`skyColor` from elevation); rim glow stays peach near the horizon and sky-blue by day. Landscape timeline rail is 104px with 16px stage right pad so the day/month label cannot widen the page. Interactive rings still stack above the hour handle. Clicking a dial legend light opens the same light-edit sidebar as a ring (closest assigned solar event to the scrubbed/now time). Event spokes match the night sun-path dash (`#d8e0ff`, `5 4`, 1px) at 50% opacity; night path is also 50%.
- **Superseded in part:** 2026-08-30 — sun halo/shadow softness is SVG radial gradients only (no CSS `filter: blur` on the moving discs). Blurring cx/cy-updated SVG circles left compositor trails (“thousand coronas”) while scrubbing and cleared on pointer-up.
- **Superseded in part:** 2026-08-30 — horizon rim peach↔sky and day-wedge alpha blend continuously with elevation (no binary nearHorizon / elev&lt;0 cuts that snapped the glow mid-scrub).
- **Superseded in part:** 2026-08-30 — year-scrub `_patchLightClock` repaints path/marks with `includeSun: false` so it does not replace `_clockSunEl` with a detached node (that skipped `_layoutClockEventSpokes` and dropped the dusk clamp dashed link mid-scrub).
- **Superseded in part:** 2026-09-01 — dial chrome uses a L/T/R surface vignette (`--primary-background-color` at ≤50% opacity) instead of a black top ramp; hour ticks/labels use primary-text color with a surface halo (not white-on-black); sunset→sunrise / dusk→dawn night wedges are light gray / mid gray (not near-black). Light theme: bloom clones at half opacity (0.4075); horizon rim uses `multiply` + warmer peach (dark keeps `screen`); sun path + event dots are black (dark keeps the prior light strokes).
- **Superseded in part:** 2026-09-01 — night wedges are theme-split (warm gray in light via CSS vars; near-black again in dark). Horizon rim / day wedge use an elevation aura: after sunset peach → pink → purple → dark blue → night; light daytime is crispy sky blue (`#4FB3FF`) with a dark night rim (not gray). Empty dial `.content` is `:empty { display: none }`; FAB clearance moves to `.page.dial-wide` padding-bottom 152px. Unavailable lights use grayscale + disabled text.
- **Superseded in part:** 2026-09-01 — L/T/R surface vignette uses longer multi-stop fades (~260/360px) for a softer blur. Horizon rim stretches ~5h with a multi-color spectrum that ends at `--primary-background-color` (normal blend); light-mode dusk stays soft (no near-black rim).
- **Superseded in part:** 2026-09-01 — dial vignette `::before` extends `right: calc(-1 * var(--scene-sidebar-gutter))` so it paints under the docked light sidebar like `.clock-horizon-back` (avoids a hard cut at the drawer). Scrub skips `_updateHorizonGlow` rebuilds when quantized elev (~0.25°) + sunrise/sunset/max elev are unchanged.
- **Superseded in part:** 2026-09-01 — vignette also extends `top: calc(-1 * var(--dial-banner-h))` (path top → host top) so draft/location banners do not leave a seam above the dial; face budget subtracts the below-header banner reach.
- **Superseded in part:** 2026-09-02 — dial L/T/R vignette is `:host([data-dial-view])::before` with `inset: 0` (full panel). Do not size it with `--scene-sidebar-gutter` / `.sun-path` — that resized the gradient during the drawer slide and artifacted.
- **Superseded in part:** 2026-09-01 — horizon spectrum RGB stops lerp continuously by elevation (same stop count at every keyframe) so scrub never swaps palettes; dark keeps peach/pink/purple/blue with a slight gold Rayleigh core through civil twilight; light stays soft. At/after civil dusk (−6°, product “last light”) the rim is dark blue only — no pink/purple afterglow.
- **Superseded in part:** 2026-09-01 — sun/handle drag hits sit under the light rings (`z-index: 6`); handle hit is tip-only (planet rim→ticks), not a center spoke, so ring clicks are not eaten along the sun angle.
- **Decision:** On create/edit, a header toggle switches the light table between the stacked bands and concentric 24-hour rings. Midnight is at the bottom; hours are equal; noon is at the top. One ring per lamp (outer = first table row); rings fill to the center (no hole). The clock face is `min(100%, 86vh)` square on a full-width dial page; solar-event icons sit in a face-size-scaled chrome band (smaller chrome on narrow faces so the graphic stays large) and stay inside the face edge. Soft radial seams blend neighboring rings; hovering the rings — or having a selected ring — animates `--clock-feather` down to sharpen them. An elevation **halo** around the light rings (rings-sized disc, transparent center, bright rim, scale 1.45, no blur) sits on the face behind the core so color peeks past the opaque bands; a tight conic horizon ramp (~5h band) paints **behind** the planet spanning the **full panel width** (sidebar overlaps; the dial still shifts left via the gutter) — multi-stop peach→pink→purple→blue dissolving into the surface color; no separate sky-color wash and no solid sunrise/sunset border rays. UI chrome (draft banner, portrait date/scrub) stacks above that bleed. Night wedges: warm gray in light theme, near-black in dark (`--clock-night-outer` / `--clock-night-deep`). Day sector fill is crispy sky blue in light. Time wraps the rim on a **perfect circle** whose radius scales with today's peak elevation vs the location's annual max (summer outer at 90% of the padded face limit, winter inner), clamped with padding so path and sun clear the planet and the dial-core edge (day solid arcs / night dashed arcs only — no full-circle dashed underlay; 1px non-scaling). Hourly ticks and labels use `--primary-text-color` (muted) with a `--primary-background-color` halo so they stay readable in light and dark themes. Event button labels use positional collision placement: top of dial → above the button; bottom → below; left/right → topmost above, others below. The sun is an outlined disc with a soft SVG shadow under a day-wedge-clipped warm white glow + solid white fill (shadow stays inside the glow so the halo reads); below the horizon fill/glow are clipped away while the shadow remains; the hour handle paints above. Size is largest (2×) at sunrise/sunset and fixed through the night; it shrinks toward 1× at zenith and grows again toward sunset. Drag the sun (or handle) to scrub freely; on release, if within ~19.5 min of a solar event, ease to that event over 2s (quintic ease-out) — otherwise keep the release time. After release the time is sticky until reset (click the sun / restore control), an event is selected, or the user leaves the editor — date and location changes keep the sticky override. Opening/changing a solar-event pin eases the sun along the path with a strong ease-out (~760ms; no jump). Dragging while that sidebar is open leaves the drawer open until pointer-up, then closes it. While sticky, a 1px white stroke on the outer tick radius runs from wall-clock now to the scrubbed time with a short white–gold wash toward the center. Selecting a solar event pins the sun to that event. Idle without sticky/event is wall-clock now on the preview date. The linear sun chart is hidden in dial view. Solar-event icons open the event sidebar; dashed spokes run from each path dot (6px) to its button. Suggested lights stay in the legend. Remember the view in `localStorage` per HA user (`scene_studio.lightView.v1.<user>`).
- **Why:** A ring makes the dusk→dawn wrap obvious. Equal clock hours match how people read “now”; solar events still land at their real times. Seasonal circle size shows how high the sun climbs without wobbling the path; elev still drives size and day/night clip. Snap-on-release keeps dragging predictable; a wider soft vignette keeps chrome readable over horizon bleed without a hard cut. Light-theme gray night wedges read as shadow without a muddy disc; dark theme keeps near-black so night is not washed out. A stretched multi-color rim that ends at the surface reads more like a real sunset than a single tint faded to transparent. Without blur, a filled glow under opaque rings vanishes — the halo must live outside the planet rim. Light-band bloom sits above the isolated horizon wash so dial colors read over the rim, not under it. Two staged per-clone blurs keep lg/md blooms distinct; compositor promotion + planet `box-shadow` still isolate static dial work from scrub. A 26px day/month in an 88px rail overflowed the stage and created a horizontal scrollbar — pad and size the rail instead of clipping the page.
- **Do not reverse without user ask.**

## Smooth cross-mode color blends

- **Date:** 2026-08-30
- **Superseded in part:** 2026-09-01 — chromatic HS↔RGB / RGB↔RGB blends lerp on the hue wheel (keep saturation; no wrap) so red↔blue stays on the rim; wheel path matches runtime. Temp↔color and rgbw/rgbww still convert to RGB and channel-lerp (bow toward white / keep white channels). Prefer `hs_color` over `rgb_color` when both are present on a draft/entity.
- **Decision:** When from/to light color modes differ, interpolate by converting each endpoint to RGB and lerping (preview dial/bands, live apply via `rgb_color`, and the sidebar wheel path). Same-mode pairs still use kelvin / HS / channel lerp. Do not flip the active extrapolator at 50% progress.
- **Why:** The old halfway mode switch snapped white↔color (and wheel polylines) whenever day scenes were color_temp and evening scenes were HS/RGB. RGB-channel lerp of saturated complements also drew a path through white, which contradicted “through the color wheel” for chromatic pairs.
- **Do not reverse without user ask.**

## Preview lists area lights before native scenes are assigned

- **Date:** 2026-08-30
- **Decision:** `build_preview` / `_light_series` returns **suggested** area lights when no solar events have native scenes yet (new extrapolation scene). Do not early-return `[], []` solely because nothing is assigned — that left dial view as an empty page (clock build bailed on zero lights).
- **Why:** Create flow picks an area first; users need the dial/legend and “create scene” affordances before any native scene exists.
- **Do not reverse without user ask.**

## Dial light list stays under the face

- **Date:** 2026-08-30
- **Superseded in part:** 2026-09-01 — `--dial-face-max` now reserves ~32px so the first light-list row peeks under the face (discoverability). List still flows under the face; do not move it into the landscape left gutter.
- **Superseded in part:** 2026-09-16 — the dial shrinks so the **full** light-tile strip fits in the stage scrollport (floor 600px, then scroll). Do not reserve only a 32px peek.
- **Superseded in part:** 2026-09-01 — draft/location `.page-banners` reduce `--dial-face-max` by their measured reach so the list still peeks above the fold; dial vignette `top` extends by `--dial-banner-h` (path→host) so it matches `.clock-horizon-back` under the banners.
- **Superseded in part:** 2026-09-16 — the under-face list is the light tile strip (full **stage** width, centered when it fits, overflow-x when it does not), not stacked `clock-legend-row` cards. It is a sibling of `.sun-path-stage` in `.sun-path` (the stage scroll), not a child of `.sun-path-body`, so the landscape year-rail grid cannot clip it. Do not move it into the landscape left gutter.
- **Decision:** The dial light list always flows **under** the clock face (portrait and landscape) at **stage-column** width. Time/sun readout and date chips live in `.sun-toolbar` in that same scroll. The landscape 3-column grid on `.sun-path-stage` is only face + year scrub (empty left gutter optically centers the dial). Do **not** put readout/tiles in `.sun-path-body` (that forced `left: calc(-1 * var(--scrub-rail-width))` and clipped the strip). Ring hover name sits flush above the outer light ring (`top` = rings inset inside the core), not above `--clock-chrome` / face chrome. Legend actions order: Add to …, then remove (X), then chevron.
- **Why:** Parking the list in the left gutter left-aligned/truncated names and broke parity with portrait. Under-face flow matches mobile. A small peek of the first row is enough to hint scroll without returning to the “shrink the dial for the whole legend” approach.
- **Do not reverse without user ask.**

## Dial defaults to clock; scrub uses event knots + Helland kelvin

- **Date:** 2026-09-01
- **Superseded in part:** 2026-09-01 — scrub knots include a midnight sample so dusk→dawn wraps overnight; date picker / chips walk intermediate calendar days on the dial (then Astral refine), and event lerp tracks solar_seconds so earliest-dusk ghosts do not jump.
- **Superseded in part:** 2026-09-02 — settled `DOMAIN/preview` also returns `event_states` only (no 5-minute sample grid). The panel paints dial rings with `knotsOnly` (same as scrub) and densifies to 5-minute samples in the browser for table view. Pointer-up still reconciles Astral sun times; light color on the dial matches scrub (knot RGB + CSS ramp), not per-step server kelvin/HS lerp. Runtime activation stays on HA math.
- **Superseded in part:** 2026-09-02 — after dial first paint, idle refine adds five RGB/brightness intermediates between each solar event (~30 stops/day). Pure RGB chords (e.g. red→blue through purple) already appeared via CSS between two knot stops; the refine matters when brightness and color both change (`darkenedRgb(lerp)` vs CSS lerp of darkened endpoints). Still not HA kelvin/HS mid-segment math. Mid-scrub stays knots-only; table keeps the 5-minute client grid.
- **Superseded in part:** 2026-09-02 — settled `DOMAIN/preview` samples mid-segment colors with the same extrapolators as activation (5 intermediates between each solar event, plus midnight) — HS-rim for RGB/HS, not a CSS RGB chord. Mid-scrub / client sun days stay `knotsOnly`; pointer-up backfills authoritative samples. Client RGB idle refine removed. Table uses settled samples when present, else densifies from `event_states`.
- **Superseded in part:** 2026-09-02 — table no longer RGB-densifies a 5-minute grid from `event_states`. Dial and table both keep settled HA samples; sparse scrub state stays knotsOnly. Switching to table with only knots refetches/reuses cached preview so bands match the dial.
- **Decision:** New users get dial (`clock`) view; an explicit `table` in localStorage is still honored. Mid-scrub ring paints use the five solar-event knots plus a midnight wrap stop (CSS conic-gradient ramps between them) and a coarse sun curve; pointer-up / settled preview restores full Astral resolution. Client `color_temp` display RGB uses Tanner Helland (`kelvinToRgb`, matching Python); HA picker `hueTempToRgb` stays for the temp wheel chrome only. Dial face max height fills below the header minus overhead and ~32px list peek; aspect-ratio stays 1.
- **Why:** Table-as-default hid the product’s primary visualization. Scrub used a different kelvin→RGB curve (white at 4200K / cool blue) than the settled preview, and dense 5-minute resampling every drag frame was heavier than needed when the ring only needs event stops mid-scrub. Knots without midnight left 0%→dawn as flat dawn. Crossfading two endpoint days skipped the year and made dusk clamp appear to teleport.
- **Do not reverse without user ask.**

## Editor overflow matches the native scene page

- **Date:** 2026-08-26
- **Superseded in part:** 2026-09-15 — the selected scene card keeps the white inset ring and adds a **blurred duplicate of the card preview** behind it. The glow is clipped to a per-card slot so it cannot paint over neighboring cards. The on-card ramp/mesh itself stays unblurred.
- **Superseded in part:** 2026-09-08 — landing scene cards paint a selected ring above the card mesh (`::after`) because inset box-shadow sat under the background. Tapping the selected card deselects and returns to the empty stage (leave-confirm still applies). The HA sidebar Scene Studio item (`/scene_studio` with no hash) also deselects: `pushState` does not fire `hashchange`, so the panel listens for `location-changed` / capture clicks on that link. Do not put an activate switch on the card. Do not `stopPropagation` on the dots trigger — `ha-dropdown` opens from that click.
- **Superseded in part:** 2026-09-08 — circadian scene-card backgrounds are one horizontal dawn→dusk ramp per member light. Stack them like table light rows: later bands overlap the previous and fade in over the top third of a full bar (same 36/108 ratio). Do not use edge-to-edge slices or `filter: blur()`. Each stop is chromatic RGB scaled by that lamp’s on-brightness (same rule as dial `darkenedRgb`). Do not flatten unique full-chroma colors across lights. Simple-scene mesh dots use the same swatch.
- **Superseded in part:** 2026-09-08 — add/remove/rename/duplicate patch `_items` and repaint the rail immediately. `_loadList` can return without rendering when a newer load wins the generation guard, and `location.hash = ""` does not fire `hashchange` when the hash is already empty — `_go` calls `_syncHash` in that case. Removing a light from the dial list also drops the preview cache and marks the row suggested so `_patchLightClock` cannot keep the old legend.
- **Superseded in part:** 2026-09-03 — landing scene cards use the same overflow (Activate, Information, Settings, Assign/Edit category, Rename, Duplicate, Delete). Card tap still opens the editor; do not put an activate switch on the card. Do not `stopPropagation` on the dots trigger — `ha-dropdown` opens from that click.
- **Decision:** Create and edit both show the native scene overflow (`ha-dropdown` + dots). Items: Activate, Information, Settings, Assign/Edit category, Rename, Duplicate, Delete. Actions that need a saved entity are disabled on `#new`. Skip Edit YAML — this panel has no YAML mode. Category opens our Save dialog with the category field visible so the store and registry stay in sync. Delete uses an `ha-dialog` with the native confirm strings, not `window.confirm`.
- **Why:** Users already know that menu from Settings → Scenes. A shorter custom menu hid Apply / info / duplicate.
- **Do not reverse without user ask.**

## List sun path uses the lightweight solar API

- **Date:** 2026-08-30
- **Superseded:** 2026-09-03 — the landing list has no solar graph. Desktop stage is empty-select or the editor; `sun_path` is not fetched on the list. The editor still uses `scene_studio/preview`.
- **Decision:** The list page chart calls `scene_studio/sun_path` (solar events + elevation only). The editor keeps `scene_studio/preview` (lights + overlays). Leaving the editor clears dial preview state; the 30s redraw only paints when `_sunPathKey === _chartKey()` so a late preview cannot unhide a dial on the list.
- **Why:** Full preview is slow and raced with navigation, so the list chart felt intermittent or stuck.
- **Do not reverse without user ask.**

## List tabs: Extrapolation scenes vs Created scenes

- **Date:** 2026-08-30
- **Superseded in part:** 2026-09-01 — Created scenes table groups rows by area (headers + name sort within group; area omitted from the row subtitle when grouped).
- **Decision:** The list has two tabs — **Extrapolation scenes** (default) and **Created scenes** (native HA scenes this integration created, tracked in store `managed_native_scene_ids`). Created-scene rows open that entity’s settings more-info; delete uses the existing confirm dialog. Only scenes registered at create time appear (no historical backfill of every YAML scene that looks related).
- **Why:** Mixing extrapolation configs with native scenes in one list was confusing; users still need a place to manage scenes the wizard/setup created. Grouping by area matches how HA lists devices once a home has several rooms.
- **Do not reverse without user ask.**

## Global setting: hide created scenes in HA UI

- **Date:** 2026-08-30
- **Superseded:** 2026-09-16 — the setting and registry hide-on-create path are removed. Store still drops leftover `hide_managed_native_scenes` on load. Native scenes this integration creates are not hidden by us; a “Hidden in Home Assistant” badge remains if HA itself hid the entity.
- **Decision:** Panel list settings sidebar exposes `hide_managed_native_scenes` (default **on** since 3.0 / Store v2+). When on, managed native scenes get `hidden_by=INTEGRATION` in the entity registry (and new creates honor it). Toggle off clears integration hides. Never override `hidden_by=USER`. Storage version bumps use a Store `migrate_func` (v3 maps preference/interval renames).
- **Why:** HA has no per-integration “hide my entities” config entry option that covers dynamically created YAML scenes; registry `hidden_by` is the supported UI hide. Default on keeps knot scenes out of the main HA scene list.
- **Do not reverse without user ask.**

## Panel copy uses HA backend translations (en/nb/nn/de/es)

- **Date:** 2026-08-30
- **Superseded in part:** 2026-09-01 — nb/nn/de/es are a single pass in the `dev` → `master` release PR, not kept in lockstep on every feature commit. `en.json` stays current during development. Key trees must still match on `master` (`check_translations.py` on PRs to `master`).
- **Decision:** User-visible panel strings live under `translations/<lang>.json` → `frontend.*` (plus existing `config.*`). The panel loads them with `hass.loadBackendTranslation("frontend"|"config", DOMAIN)` and resolves via `_t("frontend…", englishFallback)`. English is the source of truth while working on `dev`; the other four languages are filled before a release PR. See `.cursor/skills/panel-translations/SKILL.md` and `.cursor/skills/prepare-release-pr/SKILL.md`.
- **Why:** Custom integrations cannot use Lokalise/`strings.json`; shipping full language files matches HA’s custom-integration i18n path and the user’s language set. Translating on every UI tweak duplicated work; one pass against the English diff is cheaper and still ships complete trees.
- **Do not reverse without user ask.**

## List tabs use ha-tab-group

- **Date:** 2026-08-30
- **Decision:** Scene list tabs are native `ha-tab-group` / `ha-tab-group-tab` (`tabOnly`, `wa-tab-show`), not custom buttons.
- **Why:** Matches HA chrome (automation traces, etc.) and stays consistent when the design system moves.
- **Do not reverse without user ask.**

## Table/list sun path: solid day stroke, horizon ramp, dial event buttons

- **Date:** 2026-08-30
- **Decision:** Linear sun chart (list + table view): daytime path is a single solid `primary-text-color` stroke; night stays dashed with a stronger muted text mix for readability over the horizon wash. Horizon is a top border plus a peach ramp fading downward. Solar events are dial-style `clock-event` buttons on the curve (interactive in the editor; `inert` on the list). Dial clock path styling is unchanged.
- **Why:** Colored/variable dashed day strokes and tiny dots read poorly; dial buttons unify event affordances across views.
- **Do not reverse without user ask.**

## List view does not re-render on every hass assignment

- **Date:** 2026-09-01
- **Decision:** The panel `hass` setter updates child `.hass` refs and loads translations once. It does not call `_renderList` on later hass ticks. Rebuild the list from `_loadList` / tab changes / explicit actions.
- **Why:** HA assigns `hass` on every state update. Rebuilding the list tore down the FAB (visible flicker) and closed the settings sidebar via `_closeSceneSidebar()`.
- **Do not reverse without user ask.**

## Unavailable lights stay in the list, not on the dial

- **Date:** 2026-09-01
- **Superseded in part:** 2026-09-09 — clicking X excludes the lamp from store membership (`exclude`, and drop from `include`). The card FLIP-animates to the bottom, the X becomes +, and the row uses a muted **Removed** style (not grayscale). Sort is members, then unavailable members, then removed. Plus restores membership. Native YAML scene ids are not required.
- **Decision:** Clock rings omit unavailable (or missing) lights. The legend and table list still show them, sorted last, marked unavailable. Live `hass.states` is the source of truth.
- **Why:** An unavailable lamp cannot preview on the wheel; hiding it from the list would make membership edits impossible.
- **Do not reverse without user ask.**

## RGBWW/RGBW wheel uses chromatic pin, mixed band

- **Date:** 2026-09-01
- **Decision:** For rgbww/rgbw drafts, the color-wheel pin sits at hue/sat of the RGB channels (normalized, like HA more-info). Marker fill and light bands use the white-mixed display RGB (`rgbww_to_rgb` / `rgbw_to_rgb`). Picking a wheel color updates RGB channels and keeps whites. Color-brightness and white-brightness graphs edit those channels (0–255) beside overall brightness.
- **Why:** Using the raw RGB slice for the pin and band ignored white mix and color brightness, so the dial did not match HA’s entity picker.
- **Do not reverse without user ask.**

## Date and sun moves use 1.5s cubic ease-out

- **Date:** 2026-09-01
- **Decision:** Preview date changes morph sun path + light rings over 1.5s with cubic ease-out (`1-(1-u)³`). Solar-event sun moves use the same duration and curve. After year-scrub release, morph client rings to the HA preview (~0.8s) instead of swapping DOM/gradients in one frame. Quintic ease-out raced to the end then crawled; cubic decelerates across more of the span.
- **Superseded in part:** 2026-09-01 — scrub-release refine densifies 5-event knot samples onto a 5-minute grid before morphing to Astral (avoids CSS-conic→dense flash at the midnight wrap). Mid-morph skips bloom-clone gradient updates and horizon-rim rebuilds (in-place wedge `d` only); full bloom + rim paint once at the end — stacked translucent layers were doubling chroma under the dial during the transition.
- **Why:** Instant date jumps and the coarse→Astral ring swap read as flicker. A longer ease-out is the requested motion. Knot CSS ramps ≠ dense sample conics; destroying/recreating night wedges every frame flashed the bottom of the dial; updating two 0.815-opacity bloom clones every frame made mid-morph colors look stronger until settle.
- **Do not reverse without user ask.**

## Sandbox scenes.yaml is runtime, not source

- **Date:** 2026-09-01
- **Decision:** Gitignore `dev/config/scenes.yaml`. Do not commit the live file or a starter example — native scenes are sandbox-local and do not translate to other setups. First-time setup creates an empty list (`[]`) if the file is missing. Do not bind-mount a second scenes file into the container — `dev/config` is already `/config`.
- **Why:** The scene editor and this integration write HA’s native YAML back to `/config/scenes.yaml`. Tracking that file made every sandbox tweak a dirty tree and clobbered local scenes on branch switch.
- **Do not reverse without user ask.**

## CI lint uses current Home Assistant Requires-Python

- **Date:** 2026-08-30
- **Superseded in part:** 2026-09-01 — with Python 3.14, CI installs current HA, so `StaticPathConfig` stays a normal top-level import (lazy import tripped pylint `import-outside-toplevel`). Workflows use current `actions/checkout` / `actions/setup-python` majors.
- **Decision:** GitHub Actions lint/tests use Python **3.14** and install the latest PyPI `homeassistant`.
- **Why:** Unpinned `pip install homeassistant` on 3.11 resolves to ~2024.3, which lacks `StaticPathConfig` / `LockState` and breaks pytest collection via `panel.py`. Current HA requires Python ≥3.14.2; matching that keeps lint and unit tests on the same API surface as the sandbox.
- **Do not reverse without user ask.**

## Work on `dev`; a PR to `master` is a release

- **Date:** 2026-09-01
- **Decision:** Day-to-day work (and feature-branch PRs) target `dev`. Opening a PR to `master` is how a version ships: the prepare-release-pr skill syncs translations and Unreleased, then merge runs `.github/workflows/release.yml` (version bump, changelog move, GitHub release, merge back to `dev`). Do not bump `manifest.json` or move Unreleased in that PR. Do not maintain nb/nn/de/es or Unreleased during feature work on `dev`. `release:skip` (or empty Unreleased) lands on `master` without publishing.
- **Why:** Cutting the release in the agent duplicated (and fought) the GitHub workflows. Translating and changelog-editing on every change set was slower than one pass against the `master` diff. `master` stays the HACS/GitHub default so visitors see released code.
- **Do not reverse without user ask.**

## Continuous follow-up is built into the integration

- **Date:** 2026-09-01
- **Superseded in part:** 2026-09-01 — non-user `off` / `unavailable` during continuous is an *interrupt* (leave dark); when the lamp comes back, re-apply that light’s circadian target once. Available off-path jumps and HA-UI (`user_id`) changes stay overrides.
- **Superseded in part:** 2026-09-01 — public contract renamed from `continuous` / brief `follow_up` to `automatically_update_lights`, `automatically_update_lights_active`, and `automatically_update_lights_interval` (Store migrate v3). UI copy says “automatic light updates.”
- **Superseded in part:** 2026-09-01 — per-scene list play/stop removed. Master on/off is a setup-mode-style card at the top of the extrapolation list (hidden when empty) that sets `automatically_update_lights_interval` to 0 or restores the last interval; Settings still edits the minutes. Empty extrapolation list uses an HA Automations-style empty state (icon, title, body, Learn more → GitHub). Per-scene store flag is ignored (always enabled when interval &gt; 0).
- **Superseded in part:** 2026-09-01 — the list-top control includes a right-aligned `ha-switch` matching on/off (`.setup-mode-card.list-aul-card { flex-direction: row }` must follow `.setup-mode-card`’s column rule). Scene rows use a single bordered “table” surface (header + dividers) styled like HA’s config lists. Created scenes are grouped by area with sticky-style group headers. Do **not** embed `ha-data-table` / `hass-tabs-subpage-data-table` — those stay in lazy HA frontend chunks with Lit column templates and are unreliable from this custom panel (same class of problem as automation sidebar elements).
- **Decision:** After activation, circadian scenes re-apply on a global interval (`automatically_update_lights_interval`, default 300s; 0 = master off). The same value is the light transition on those ticks; targets use `now + transition` (existing offset math). First activation keeps the caller’s transition (usually 0); wait one interval, then auto-update ticks. Stop when another scene in the area is last-activated or when modifiers are set. Skip manually overridden lights; treat drift/unresponsive within tolerance (or still moving toward the command) as retryable. Do not stop merely because all lights are off (dawn). Do not ship this as a blueprint — blueprints cannot skip lamps inside apply or keep commanded vs reported state.
- **Why:** The user’s continuously-activate blueprint was a roundabout loop and blocked override/drift features. Built-in automatic updates match the product and keep override state on the scene entity. Power-cut restore must reclaim the lamp; a reading-light dim must not. “Update lights” names what changes; “update scene” would sound like editing the scene definition.
- **Do not reverse without user ask.**

## Prefer readable public keys for automatic light updates

- **Date:** 2026-09-01
- **Decision:** Use long store/entity/WS names `automatically_update_lights` (+ `_active`, `_interval`) rather than short jargon (`continuous`, `follow_up`). Length is acceptable when it removes ambiguity.
- **Why:** Users inspect attributes and settings; clarity beats HA-style brevity here.
- **Do not reverse without user ask.**

## Light sidebar UX: graph path colors, room preview, sticky undo

- **Date:** 2026-09-02
- **Decision:** Brightness-graph stroke densifies mid-segment colors with the same draft lerp as the hue-wheel path (~8 stops per segment) — cheap client work, not HA mid-segment samples. Graph nodes use a 10px drag threshold and do not write brightness on pointerdown so taps can select a scene; dragging shows live brightness %. Live edit defaults on and both Live edit / Preview room prefs persist per user in localStorage. Preview room applies interpolated light samples at the sticky/scrubbed dial time, pauses while any sidebar is open, and refreshes on scrub/sun release (and after preview settle). Activate scene applies `event_states` plus session drafts (not bare `scene.turn_on` when draft lights exist). Narrow light sidebars put undo/redo in a sticky footer; undo/redo restore focus reopen the light editor for that lamp/event.
- **Superseded in part:** 2026-09-16 — Landscape Now/Sun° and date chips live in `.sun-toolbar` in the stage scroll (full column). Do not offset the readout with `left: calc(-1 * var(--scrub-rail-width))`.
- **Superseded in part:** 2026-09-02 — app bar keeps **Preview scene** (was Preview room); **Live preview** (was Live edit) moves into the light sidebar footer. Location override + Table/Dial view are overflow-only on all widths; overflow **Activate** is removed (Preview scene covers whole-scene live apply). Banner / Now/Sun° share a 16px left inset.
- **Superseded in part:** 2026-09-09 — app bar label is **Live edit**; it applies the open scene at the selected clock (including sun drag, 1s / `transition: 1`), starts when the scene is selected if the pref is on, and restores snapshots when the scene is deselected. Theme-event sidebars no longer pause that apply. See “Live edit applies the scene at the selected clock; play walks 24 hours”.
- **Why:** Graph chords looked flat vs the wheel; accidental brightness jumps on select were common; room preview needs a explicit toggle separate from single-lamp live edit; mobile undo was buried in the app bar under the sheet.
- **Do not reverse without user ask.**

## Live edit applies the scene at the selected clock; play walks 24 hours

- **Date:** 2026-09-09
- **Superseded in part:** 2026-09-22 — the same header **Live edit** also applies a normal scene’s stored light drafts while that editor is open, and restores the snapshot when it turns off or the editor closes. Play stays circadian-only.
- **Decision:** App-bar **Live edit** snapshots member lights when it turns on or when a scene is opened with the pref set, then applies interpolated `light.samples` at the sticky/idle clock via `_applyLightState`. Only `light.*` members are sent (`theme:` rings and other non-light rows are skipped — HA rejects them as `entity_id`). Sun drag updates physical lights on a 1s cadence with `transition: 1`. Theme-event and light sidebars do not pause app-bar **Live edit** or disable header controls. The light-sidebar **Live edit light** switch is shown only when app-bar **Live edit** is off (`display:none` must beat `.live-edit-toggle { display: inline-flex }`). Desktop light sidebars omit undo/redo (header already has them); mobile keeps them in the footer. Leaving the scene restores the snapshot. **Play scene live** is a split control on the readout (play/stop | duration ▾), not a Settings field. Do not `stopPropagation` on the duration chevron — `ha-dropdown` opens from that click (same as overflow dots). Duration presets are 10/15/30/60/90/120s (default 30). Unset or non-positive localStorage is 30 — do not clamp `0`/`null` to the old 5s minimum (that made Settings look like 5s and the `ha-selector` upgrade wrote 5). Play walks one full 24h from the current selected time, ticks lights every 1s with `transition: 1`, and any manual clock change stops it. Stop with Live edit off restores the pre-play snapshot; stop with Live edit on leaves the room at the stopped time. Time-override glow remembers clockwise vs counterclockwise so it wraps past 12h instead of flipping to the short arc.
- **Why:** Preview has to match what Save would do at that clock, including while scrubbing the sun. Play is a traffic-limited day walk, not a second apply path. Restoring on deselect avoids leaving the house in a draft after browsing scenes.
- **Do not reverse without user ask.**

## Light sidebar effect menu listens on the inner ha-dropdown

- **Date:** 2026-09-09
- **Decision:** Apply the chosen effect from `wa-select` on the `ha-dropdown` inside `ha-control-select-menu` (rebind when the menu is enabled). Do not rely on a `select` event on the control — HA no longer fires it after the dropdown migration, and `wa-select` is not composed through the control’s shadow root.
- **Why:** Selecting an effect looked like a no-op: the UI opened, but the draft never updated.
- **Do not reverse without user ask.**

## Palette variables (five slots, per-light assignment, mode pill)

- **Date:** 2026-09-15
- **Superseded in part:** 2026-09-24 — the preset row is color variables only, and the mode pill lists every wheel disk, including ones the selection cannot use (“Scene base palette is a corner split button, not a preset”).
- **Decision:** Color variables (`kind: color`) and palettes (`kind: palette`, always five slots) are separate library kinds. The area rail lists Variables, then Palettes, then Circadian themes. Editors are dedicated (`#variable/<id>|new` vs `#palette/<id>|new`) — no Color/Palette tabs that convert one into the other. A slot is a static color+brightness or a `variable_ref` to a **color** variable only (nested palettes are invalid). Applying a palette to a theme event, simple scene, or light stores the palette id; unpinned lights pick a rim slot with FNV-1a `hash(seed, entity_id) % 5` so adding a lamp does not reshuffle others. `assignment_seed` lives on the application site (theme event, simple scene, or light override). **Randomize** changes that seed and clears stored `palette_t`/`palette_r`. Dragging the palette wheel stores polar `palette_t` (around the rim) and `palette_r` (0 = white center, 1 = rim) while keeping `variable_ref`, so the pin stays linked to the palette. Brightness on the event/light can differ from the sampled slot. The mode pill and the preset row are in “Scene base palette is a corner split button, not a preset”.
- **Why:** Multi-light scenes need several related hues from one named token without each lamp sharing one solid. Hash+seed is stable; the polar wheel is how the user pins a blend between those five rim colors.
- **Do not reverse without user ask.**

## Color/kelvin mode selector matches huemane-light-card

- **Date:** 2026-09-16
- **Superseded in part:** 2026-09-24 — see “Scene base palette is a corner split button, not a preset” for the preset row and the mode pill.
- **Decision:** The wheel mode control is the Hue/huemane pill: 48px capsule (`8px` padding, `8px` gap, `0px 2px 3px` shadow, `--surface-2` / `#242022`), 32px wrappers with 24px faces, 2px white ring when active. Color and kelvin faces use the PNGs from `etokheim/huemane-light-card`. It sits in `.hue-wheel-chrome` **bottom-left**; color-variable swatches stay **bottom-right**. Do not overlay a larger custom pill on the disk.
- **Why:** That control is already the house language for switching wheels; a top-centered 36px version read as a different widget.
- **Do not reverse without user ask.**

## Main column is the editor

- **Date:** 2026-09-16
- **Decision:** `.stage-col` is the editor for scenes, variables, palettes, and circadian themes. Routes: `#edit/<id>`, `#variable/<id>`, `#variable/new`, `#palette/<id>`, `#palette/new`, `#theme/<id>`, `#theme/new`. The area rail only picks items. Do not add/edit library items in `ha-dialog`.
- **Why:** Dialogs hid the workspace and split create vs edit. One column keeps the same place for every kind of edit.
- **Do not reverse without user ask.**

## Simple-scene lights are huemane light tiles

- **Date:** 2026-09-16
- **Superseded in part:** 2026-09-16 — the same light-tile strip is the circadian dial light list (under the face), not only simple scenes.
- **Superseded in part:** 2026-09-22 — the simple-scene strip has no long-press mode picker. Grouping, multiselect, and the settings dialog are in “Scene tiles, create menu, and rename”. Circadian tiles still open the light sidebar on tap.
- **Decision:** Simple-scene members and the circadian dial list are huemane light tiles (content-box **85×135**, 5px pad, radius 24 — switch slot reserved even when unused). Fill-from-bottom `--hue-light-fill`, dual clipped label layers, 2px selected ring. Tile chrome uses huemane transitions (`all 0.3s ease-out`, fill/clip 0.3s, wheel scrub 25ms, press scale 0.95). They sit in a full-column `overflow-x` strip with `flex: 0 0 auto` so the wheel cannot collapse it; the inner row is `width: max-content; margin-inline: auto` so a short list centers and an overflowing list scrolls from the start. Vertical drag/wheel owns brightness after an 8px axis lock; horizontal pan stays native strip scroll. Do not use circular tiles or 85×90 squat cards.
- **Why:** The circular strip only shared wheel-to-brightness; the cards are the house language for lights.
- **Do not reverse without user ask.**

## Lighting chrome is ours, launched from huemane-light-card

- **Date:** 2026-09-16
- **Decision:** Mode pill, light tiles, and related wheel chrome in this panel are **our** components (`frontend/light_tiles.js`, `hue_mode_icons.js`, color-wheel chrome). They were built to match `etokheim/huemane-light-card` as a launchpad. Future lighting UI should reuse and extend these, not re-clone huemane or invent a third card language. Improve in place when the product needs it.
- **Why:** Matching huemane got the house language in the door; Scene Studio owns the next steps (circadian fill at the clock, membership, palettes).
- **Do not reverse without user ask.**

## light tiles under the circadian dial

- **Date:** 2026-09-16
- **Superseded in part:** 2026-09-22 — that settings-dialog click is the simple-scene editor only. A circadian tile tap still opens the closest-event light sidebar.
- **Decision:** Circadian scene edit (`#edit/<id>` dial) lists area lights as the same light tiles as simple scenes: horizontal strip, centered when the row fits, overflow-x when it does not. Fill/color follow the interpolated sample at the clock. Tap still opens the closest-event light editor; add/remove stay on the tile. Theme-look (`#theme`) has no member strip.
- **Why:** One light language in both editors. Stacked HA-style legend rows read as a different product.
- **Do not reverse without user ask.**

## Selected scene-card glow

- **Date:** 2026-09-16
- **Decision:** The selected scene’s `.card-glow` is always in the slot (opacity 0 when idle). Select fades it in (`opacity` 0.35s) to **0.55**; deselect fades it out before leaving `#edit/<id>`. The blur copy is `scale(1.1)` (not 1.22). Slots do not `overflow: hidden` or `isolation: isolate`, so the blur is not clipped to the card. Glow is `z-index: 0`; scene cards and other rail controls are `z-index: 1` in the shared rail stacking context so the glow can bleed under neighbors without covering them.
- **Why:** A hard clip made the halo a rectangle; painting the glow on top of adjacent cards hid their content.
- **Do not reverse without user ask.**

## Area rail keeps scroll; stage resets

- **Date:** 2026-09-16
- **Decision:** Re-rendering the workspace (selecting another scene, variable, palette, or theme) restores `.area-rail` `scrollTop` **after** the workspace height is applied, and ignores scroll events during that restore (a too-tall rail would clamp `scrollTop` and overwrite the saved value). `.stage-scroll` resets to the top so the new editor starts at its face. The rail still remounts with the landing tree (selected/glow state); do not treat a small jump as “reset to 0”.
- **Why:** Recreating the rail DOM was jumping the picker; the editor column is a new document. Restoring immediately after `replaceChildren` ran before workspace height settled, so the browser clamped `scrollTop` and the scroll listener saved the clamped value.
- **Do not reverse without user ask.**

## Palette rail chips are overlapping hue-presets

- **Date:** 2026-09-16
- **Decision:** Area-rail palettes are five overlapping slot discs in a `.hue-presets`-style capsule (48px min-height, 8px pad, 24px radius, `0px 2px 3px` shadow, `--surface-2`), not a single conic `palette-dot`. Slot colors come from `resolveSlot` + `variableSwatchCss`.
- **Why:** Palettes are five colors; a striped disk hid that. The wheel already uses the hue-presets capsule.
- **Do not reverse without user ask.**

## Re-render when HA `narrow` changes

- **Date:** 2026-09-16
- **Decision:** When Home Assistant sets the panel `narrow` property (sidebar overlay / mobile), `_render()` so the workspace remounts: rail-only + header back on narrow editors, rail+stage on wide. Do not only update app-bar flags.
- **Why:** `renderLanding` / `_renderEditor` branch on `_narrow`. Resize without a remount left the desktop tree until a full reload.
- **Do not reverse without user ask.**

## Palette editor is wheel + light-tile slots

- **Date:** 2026-09-16
- **Decision:** Palette edit (`#palette/<id>`) uses the simple-scene chrome: color wheel plus five light tiles (`slot:0`…`slot:4`). There is no slot color list. Slot brightness is the same vertical drag/wheel as lights. Tile clicks, including Cmd/Ctrl, Shift, and a click on the empty stage, go through `tileSelectionAfterClick` — the same helper as the scene strip. Do not give the palette editor its own selection rules. A palette slot that changes group uses the same strip flight as a scene light. Simple-scene and palette navigation keeps that editor mounted and retargets tiles, pins, groups, chips, the stage cover, and the mode/variable rows by index. Opening either editor starts with no light selected.
- **Why:** Palettes are the same color language as lights; a numbered swatch list was a second editor. Rebuilding the wheel on every scene or palette change threw away the tiles and pins that were already on screen.
- **Do not reverse without user ask.**

## Create persists immediately; undo deletes

- **Date:** 2026-09-16
- **Superseded in part:** 2026-09-22 — an area plus (or empty area) opens “Create circadian scene” and “Create scene”, then saves that kind immediately. Undo still deletes the new record.
- **Decision:** Add scene / variable / palette / theme saves a named record at once and opens the editor. The undo stack stores a `created` entry so Undo deletes that record and Redo recreates it. Do not leave an unsaved `#…/new` draft as the create path.
- **Why:** The rail is the source of truth; a draft that is not in the list looks like a failed add. Session snapshots do not include the library list, so create needs its own undo record.
- **Do not reverse without user ask.**

## Cardinal hour numerals sit 12px farther out

- **Date:** 2026-09-16
- **Decision:** 00/06/12/18 labels sit **12px** farther from the dial center than the previous tick-tip inset (`CLOCK_HOUR_LABEL_OUTSET_PX`). Chrome still sizes to the un-outset inset so the numerals stay on the face.
- **Why:** They sat too tight on the planet.
- **Do not reverse without user ask.**

## Dial light tiles follow clock time; brightness when an event is selected

- **Date:** 2026-09-16
- **Decision:** Circadian light-tile fills interpolate at the displayed clock time. While a solar event is selected (and the sun is not sticky-scrubbed), fills use that event’s stored/override color and brightness. Vertical drag and wheel write `overrides[light][event]` brightness (0–255). Add-light tiles use a **dashed** 2px border, not a solid inset ring.
- **Why:** Tiles were tap-only and kept stale `light.samples` after a dial patch, so they did not match the clock or take brightness edits.
- **Do not reverse without user ask.**

## Dial and simple-editor enter/exit

- **Date:** 2026-09-16
- **Supersedes in part:** clock enter plays once per editor visit (reset on list); 2026-09-16 reverse-exit before mount.
- **Decision:** Switching between the empty stage, the circadian dial, and simple/variable/palette editors **crossfades**: outgoing `.stage-scroll` **and** `.stage-bg` (horizon/bloom) content is lifted into a `.stage-motion-layer` overlay while the next view mounts underneath. Motion starts on hash change, not after the list/item websocket. Enter and exit **both scale up** (in 0.92→1, out 1→1.08) with a ~280ms fade / ~400ms scale using **ease-out only** (`cubic-bezier(0.2, 0, 0, 1)` — never ease-in). The dial still adds a short overlay spin and sun arc on enter only. Dial→dial and simple→simple skip the motion. Empty stage uses the same enter. Reduced motion skips both. Deselecting a selected rail card navigates immediately (do not wait for the card-glow opacity transition). Incoming circadian **still lays out** its horizon onto `.stage-bg` while a non-dial overlay is exiting; skip horizon layout only when the fading layer **contains** that dial’s face/sky (so we do not steal the outgoing circadian wash).
- **Why:** Awaiting a reverse (scale-down) exit, then the list websocket, then a 450ms glow fade made leaving a circadian editor feel idle for half a second. Ease-in on exit delayed the first visible motion. Horizon lived on `.stage-bg`, so lifting only the scrollport left sky graphics on the next surface. Blocking *all* horizon layout whenever any overlay existed left simple→circadian with an unsized sky until a later preview rebuild.
- **Do not reverse without user ask.**

## Stage empty copy matches HA empty states

- **Date:** 2026-09-16
- **Decision:** The unselected-scene (and first-run) stage empty is Home Assistant’s empty-state layout: large muted icon, title, two body paragraphs, Learn more + open-in-new. No decorative rings.
- **Why:** Concentric rings read as a fake dial, not HA’s “Start automating” empty.
- **Do not reverse without user ask.**

## Simple editors have no stage wash

- **Date:** 2026-09-16
- **Decision:** Horizon, clock bloom, and stage-bg wheel glow belong on dial views only. Simple scene / variable / palette wheels do not `attachGlow` onto `.stage-bg`.
- **Why:** That wash is the sun-path language; a color wheel is not a sky.
- **Do not reverse without user ask.**

## New items are Untitled until named

- **Date:** 2026-09-16
- **Decision:** Create scene / variable / palette / theme stores **Untitled** (translated). Editors have no Name field. While the open item is still a placeholder name, a corner FAB (**Name scene/palette/variable/theme**) opens the rename dialog, prefilled with a logical name (`{Area} Circadian` for circadian scenes, area name for simple, Variable / Palette / Theme otherwise). Unnamed scene cards also show a rename control left of the overflow menu.
- **Why:** Forcing a name at create blocked getting to the editor. The FAB is the prompt once you can see what you made.
- **Do not reverse without user ask.**

## light tile X is mouse-hover only; touch removes from the sidebar

- **Date:** 2026-09-16
- **Superseded:** 2026-09-23 — settings, remove, and power live on plates behind the tile. See “Tile actions and light-mode depth”.
- **Decision:** The close control on a member light tile is visible only under `(hover: hover) and (pointer: fine)` while the tile is hovered. Coarse pointers get no hit target. Touch (and mouse) can remove from the light sidebar (**Remove light from scene**). Removed/suggested tiles have no corner plus; the bulb icon becomes plus and the label is **Add {name}**, and tapping the tile restores membership. The X is a native 40px disc (not `ha-icon-button`, whose MDC hit stays 48px) whose center sits on the tile’s top-right corner; the strip pads so overflow-x scroll does not clip it.
- **Why:** A 32px corner control is a fat-finger trap on the brightness tile, and overflow-x auto would otherwise clip a corner-centered control.
- **Do not reverse without user ask.**

## Brightness drags skip dial resample and event-button easing

- **Date:** 2026-09-16
- **Decision:** While a brightness scrub is in progress (light tile, sidebar graph, or radial event handle), write the override and paint handles/tiles immediately. Do not resample the sun path, ease event-button radii (`CLOCK_BRIGHT_MOVE_MS`), or autosave until pointerup. Tile fill CSS transitions are off during that scrub.
- **Why:** Full `_patchDialFromSession` plus a 400ms ease made the dial buttons lag and reverse while the pointer was still moving.
- **Do not reverse without user ask.**

## light-tile fill ramp shrinks as brightness approaches 100%

- **Date:** 2026-09-16
- **Decision:** The fade at the top of a light-tile fill is at most 20px, and no taller than the unfilled remainder of the tile. At 100% there is no ramp.
- **Why:** A fixed 20px wash made a full tile look partly dim.
- **Do not reverse without user ask.**

## Add light is the last light tile; unavailable stays editable when caps are known

- **Date:** 2026-09-16
- **Decision:** “Add light” is the last card in the light-tile strip (same 85×135 chrome, dashed/plus), not a separate `ha-button`. Unavailable lights sort after available ones (still before suggested/removed). If Home Assistant still reports color modes or kelvin range, the tile stays editable (`caps-known`); only unknown-capability unavailable lights are inert and grayscale.
- **Why:** The strip is the membership UI. An unavailable bulb we already know how to drive should still be tunable.
- **Do not reverse without user ask.**

## Simple-scene wheel groups nearby pins; no travel path

- **Date:** 2026-09-20
- **Superseded in part:** 2026-09-22 — a stacked pin drag writes every member; clicking the stack fans the pins; the mode pill converts the selection. A plain light-tile click still selects only that light and peels its pin, and also opens the light settings dialog. Cmd/Ctrl-click and Shift-click multiselect instead of opening the dialog (see “Scene tiles, create menu, and rename”).
- **Decision:** The simple-scene color wheel does **not** draw the circadian travel/preview path (simple scenes do not interpolate). Pins within 10% of the wheel radius and the same mode merge like `huemane-light-card` (`tryMergeMarkers`); the stack shows a count and moves together. A light-tile click selects only that light and pulls its pin out of the stack. Clicking the stack (without dragging) fans the pins. The color/kelvin pill converts every selected draft that supports the mode and glides those pins; the rest stay and leave the selection. A single selected pin shows the light’s `mdi` icon (simple) or the solar-event icon (circadian); a stack still shows the count. **Select all** selects every member; a drag writes every selected draft that supports the disk under the pointer. Circadian wheels keep the solar-event path and ungrouped per-event pins. Membership add/remove tiles (hover X, leftover add-back tiles) are the same in both editors. Re-adding a removed light must not change strip scroll or the current selection. The simple-scene disk is the leftover height in the stage scrollport above the light-tile strip (mode row included), down to 400px, then the stage scrolls.
- **Why:** Simple scenes were using the circadian path by treating every lamp as a cycle. Huemane’s grouping and Select all are the right multi-light controls once animation is gone.
- **Do not reverse without user ask.**

## Frontend checks are node:test plus the sandbox, not Playwright

- **Date:** 2026-09-22
- **Decision:** Rules that do not need Home Assistant live as pure functions and run in CI with `node --test tests/frontend/*.test.mjs`: wheel grouping (`color_ui.js`), light-tile color groups and modifier selection (`light_tiles.js`), and the simple-scene card dot (`scaledCardRgb` in `card_mesh.js`). Layout and pointer behavior are checked against the local Docker sandbox with Chrome DevTools MCP. Do not add Playwright, or another browser runner, to CI or as a local suite.
- **Why:** Those bugs were rules about who moves, who is selected, and what color the card paints. Unit tests lock that in without Home Assistant. The panel is a custom element inside HA’s shadow DOM, behind login, with a versioned asset URL. Playwright would need Docker, sandbox credentials, and a full HA boot, and it would still miss the rule tests. A component harness would also have to fake `ha-icon`, dialogs, and `hass`. Chrome MCP already drives the real sandbox, so it stays the layout check.
- **Do not reverse without user ask.**

## Theme brightness ghost + snap-to-clear override

- **Date:** 2026-09-20
- **Decision:** When a light’s event brightness differs from the theme (more than `THEME_BRIGHTNESS_SNAP`, ~2%), the sidebar brightness graph shows a small theme-brightness dot and a dashed high-contrast polyline to neighboring knots at the theme radius. The selected-light dial brightness loop shows the same dots on the polar wrap. Dragging brightness back onto the theme knot clears that event’s override if color/look still matches the theme; a remaining color override keeps the payload with theme brightness. The light sidebar lists current overrides (event name + brightness/color). light tile wheel uses `TILE_BRIGHTNESS_WHEEL_STEP` (8/3) — one-third the old per-notch step.
- **Why:** Overrides were invisible except as a shifted handle. The ghost is the theme baseline; snap-to-clear avoids leftover “same as theme” overrides.
- **Do not reverse without user ask.**

## Circadian edit is dial-only; graph plus does not add membership

- **Date:** 2026-09-16
- **Decision:** Circadian scene edit always uses the 24-hour dial (no stacked light-bar table, no Table/Dial overflow toggle). Sidebar brightness handles for events the lamp is not in have no `+`; click selects that solar event. Adding the light is the light tile / Add light path, not a typical-peer seed from the graph.
- **Why:** Table view duplicated membership chrome. Graph `+` looked like per-event add while scene membership is per-lamp.
- **Do not reverse without user ask.**

## Scene tiles, create menu, and rename

- **Date:** 2026-09-22
- **Superseded in part:** 2026-09-22 — a plain click selects that light and does not open entity settings. Settings are a hover button beside the remove control. Group labels are vertical and show “Select all” on hover. The same groups are on the circadian strip. A wheel drag fades a visible color or kelvin disk when none of the dragged lights can use it. Area create uses `ha-dropdown`, the same menu as the scene-card overflow.
- **Decision:** In the simple-scene editor, light tiles are grouped by the color mode they are in now (color, temperature, white, brightness). The group label is vertical; hovering it reveals “Select all”, and clicking it selects that group. The circadian dial strip uses the same groups, from the light’s current event color. Cmd/Ctrl-click toggles one tile, Shift-click selects a range, and Cmd/Ctrl+A selects every member in the simple editor. Arrow keys move that selection; Shift+arrow extends it. A plain click selects only that light and peels its pin. A hover-only settings button beside the remove control opens the light’s settings dialog. The long-press mode picker is gone. While a pin drag is moving, a visible color or kelvin disk fades out when none of the dragged lights support that disk. The area-rail card mesh repaints from the live drafts while the wheel or brightness changes. Each dot is `scaledCardRgb`: chromatic RGB times brightness/255; off or brightness at or below 0 is black. Each area’s plus (and empty-area) button is an `ha-dropdown` with “Create circadian scene” and “Create scene”. User-facing copy says “Scene”; the stored kind stays `simple`. Rename (editor and card) does not offer an area picker — the scene stays on its area. It does offer Icon (always visible), plus Category and Labels as chips until filled, matching native scene rename. The icon is stored on the scene and written to the entity registry. The Home Assistant sidebar icon for this panel is `mdi:palette`.
- **Why:** Multiselect and mode groups are how a room of mixed bulbs is edited. The long-press picker duplicated the wheel. The card has to follow the drag, not the save. “Simple” is not a useful distinction in the UI. Area is chosen by where the scene was created; icon, category, and labels are the native rename fields.
- **Do not reverse without user ask.**

## Light strip motion, mode pill, and one legend

- **Date:** 2026-09-22
- **Superseded in part:** 2026-09-24 — the mode pill no longer hides a disk the selection cannot use. See “Scene base palette is a corner split button, not a preset”.
- **Decision:** Reordering the light strip (simple editor and circadian dial) animates tiles and group labels from their previous positions. The dial legend is removed from the sun path whenever the clock is rebuilt. Switching between a scene and a circadian scene must leave one strip.
- **Why:** Grouping moves tiles between buckets, and that jump read as a glitch. The legend node stayed on the sun path after its reference was cleared, so the next editor appended another strip.
- **Do not reverse without user ask.**

## Kelvin track drag, live groups, and level-only lights

- **Date:** 2026-09-22
- **Decision:** While a pin is in kelvin mode on an outer ring, it sits on the track centerline — the same place it rests when released. Pulling inward toward a color disk the light supports eases the pin slightly off that line until the convert threshold, then the pin glides to the cursor. A mode change during the drag moves that light’s tile into the new group immediately. Lights that can only do brightness or on/off are not drawn on the color or kelvin disks. Selecting only those lights replaces the disks with the native more-info controls: a vertical `ha-control-slider` (percent, relative time, power button) for brightness, and a vertical reversed `ha-control-switch` (on chunk at the top, bulb icon) for on/off. The sandbox bedroom includes two on/off virtual lights (`light.soverom_leselys`, `light.soverom_nattlys`) for that case.
- **Why:** The kelvin ring is a track, not a filled disk, so the pointer’s radius was a false position. Waiting until pointer-up to regroup hid the mode change. A brightness bulb has nothing to do on a color wheel. The thin slider row did not match the native light editor.
- **Do not reverse without user ask.**

## Kelvin side, group chrome, and tile brightness

- **Date:** 2026-09-22
- **Superseded in part:** 2026-09-23 — Select all no longer writes one brightness onto every member. See “Select all is relative”.
- **Decision:** Dropping a temperature pin on the left of the kelvin ring leaves it on the left. That side is remembered only on the live wheel; a refresh places every temperature pin on the right again, and the side is not written into the draft. Color and temperature groups use the same surface, shadow, and padding as the mode pill. On/off members resist and snap at halfway (huemane: resistance 0.56, jelly). A light that cannot do color or kelvin is grouped as brightness even when its stored draft is still `color_temp`. Every light tile, including Select all, shows its brightness percent on a second line.
- **Why:** The centerline math always used the positive x, so a left drop jumped right. Persisting the side would make refresh disagree with the default distribution. Soverom garderobe is brightness-only hardware with a stale kelvin draft, so capability has to win over the stored mode.
- **Do not reverse without user ask.**

## Empty disk click, group label, and drag readout

- **Date:** 2026-09-22
- **Decision:** In the scene editor, a click on the color or kelvin disk that is not on a pin clears the selection. It does not move the selected light. Variable, palette, and light-sidebar wheels still place color from an empty-disk click. Select all and Add light sit on the same baseline as tiles inside a group. The HS/kelvin readout while dragging is anchored above the pin body, not on the tip. The group-label layout in the next entry replaces the earlier top-name / bottom-icon column.
- **Why:** Clicking the disk was a second way to throw the selected bulb to the cursor. The readout was drawn from the pin tip, so it covered the pin.
- **Do not reverse without user ask.**

## On/off tiles, native switch, and group labels

- **Date:** 2026-09-22
- **Decision:** On/off light tiles say On or Off. Select all still shows the average percent. The on/off stand-in is `ha-control-switch` with the `vertical` and `reversed` attributes set (the properties do not reflect, and the component’s layout is attribute CSS). Brightness and on/off stand-ins sit on the same blurred glow as the color wheel. The group label’s name is centered; the select-all icon is pinned to the bottom of the group (see the landscape-wheel entry). Both share the label color, including hover. An invisible inset on the label enlarges the touch target. Selecting a pin or clicking the empty disk updates selection in place; the strip rebuilds only when a light changes group. Select all is painted at its average fill the first time, so a rebuild does not animate up from empty.
- **Why:** Forcing a horizontal switch to 130×320 drew the thumb as a full-height column on the right. Rebuilding the strip on every disk click replayed the Select all fill transition.
- **Do not reverse without user ask.**

## Wheel aside follows the light-list gutter

- **Date:** 2026-09-25
- **Supersedes in part:** “Landscape wheel chrome” — the vertical mode and variable column is no longer an aspect-ratio query.
- **Decision:** The disks stay centered in the editor column, and the light list stays under them. The color modes and variables stack in a column centered on the disk while they fit 48–80px past the disk’s edge (80px when the gutter allows, closing toward 48px, then the horizontal row). Labels sit to the right of each dot. The color modes stick to the top of that column, with a gap and a rule above the variables. A selected dot keeps the same 2px gap before its white ring as the horizontal row. A click on a variable applies it to the selected lights and does not clear that selection. A click on a pin only selects it; the color changes after the pointer moves past the drag threshold. A collapsed group dot grows from the single-dot size toward 32px across as the group goes from two lights to four or more. The hit target stays 40px.
- **Why:** The aspect-ratio switch put the names in the corner of the wheel box, and a click was already writing a color.
- **Do not reverse without user ask.**

## Landscape wheel chrome

- **Date:** 2026-09-23
- **Superseded in part:** 2026-09-23 — the aside query is the wheel box (`.simple-wheels`, `container-name: wheel`), not the stage. Pulling the chrome out of the stage made that box look landscape and left the column up in a portrait wheel.
- **Superseded in part:** 2026-09-23 — a portrait viewport keeps the horizontal row even when the wheel box is wider than it is tall. The aside query only applies in a landscape viewport.
- **Decision:** When the wheel box is wider than it is tall and the viewport is landscape, the color-mode toggles and the variable list are a right-hand aside positioned over the stage, so the disk stays centered in the full width. Mode buttons show Color, Temperature, or Palette beside the icon. The selected ring wraps only that color; the label is bold and fully opaque, and unselected rows are at 75% opacity. Variable names stay visible, and that list has no capsule background. The aside scrolls as one column; a mask feathers whichever edge still has more to scroll. A square wheel, a portrait wheel, or a portrait viewport keeps the horizontal row under the disk, with names only in the tooltip. When a scene card is selected, the rest of the area rail fades until the pointer is over the rail. The first time the rail is shown, it scrolls so that selected card is in view. The group label’s name is centered in the group; the select-all icon is absolutely positioned at the bottom so it does not shift that center.
- **Why:** The horizontal row spent the leftover width beside a landscape disk. The side column is wide enough for the names.
- **Do not reverse without user ask.**

## Select all is relative

- **Date:** 2026-09-23
- **Superseded in part:** 2026-09-23 — with one or no lights selected, the Select all gesture changes every member. Two or more lights, or a touch long-press, is select mode.
- **Superseded in part:** 2026-09-23 — Select mode no longer fills the tile with solid primary. On/off lights are no longer folded into the Select all average or snapped by their own drag resistance. The tile name is the selection count and the second line says Deselect, on both label layers.
- **Superseded in part:** 2026-09-23 — the gesture scales each light by the change in the shown average, instead of adding the same delta.
- **Superseded in part:** 2026-09-23 — group titles stick at the left of the strip, not the Select all tile. Tiles that slide under a stuck title fade through a ramp whose solid end is 90% opacity.
- **Superseded in part:** 2026-09-23 — that ramp uses the group’s own fill, stays inside the group’s border, and does not cover the first tile until the title sticks. Its left corner matches the group and falls to 0 once the title has been stuck by that radius.
- **Decision:** Dragging or scrolling the Select all tile scales each dimmable light by the next shown average divided by the average at the start of the gesture. One light at 100% and one at 50% show 75%; taking that to 37.5% makes them 50% and 25%. A light already at 0% stays at 0%. A light stops at 100% if the scale would pass it. If the starting average is 0%, every dimmable light takes the new level so the gesture can turn them on. On/off-only lights do not change that average; they follow it, on at or above 50% and off below. With one or no lights selected it covers every member. Select mode (two or more lights, or a long-press on touch) covers only the selection, fills the tile with the primary color at 32% opacity, draws a solid primary border, and shows the count. A tap selects every member, unless select mode already has two or more, in which case it clears them. In select mode a tile tap toggles that light; otherwise a tap selects only that light. Each group title sticks 8px from the left of the strip while that group is on screen. Until it sticks, it has no ramp, so the first tile stays clear. Once it sticks, tiles that slide under it fade through a ramp in the group’s own fill. The ramp stays inside the group border, on the padding edge, and its left corner matches that inner radius, staying on the group’s corner while the title is stuck. The corner becomes 0 once the title has been stuck by that radius, because the curve has slid away and the visible edge is straight. The ramp also stops before the group’s right border. A landscape wheel keeps the mode and variable column absolutely on the right so the disk stays centered. The selected row’s ring wraps only the color, its label is bold, and unselected rows are at 75% opacity.
- **Why:** Writing the finger position onto every draft made a dim lamp jump to match a bright one. The count is how you see which lights the gesture will move.
- **Do not reverse without user ask.**

## Light strip chrome

- **Date:** 2026-09-23
- **Decision:** Removed lights sit in a Removed group and show no brightness. Unavailable lights sit in an Unavailable group. The tile face and those groups use the same glass stroke as the rest of the panel. The brightness and on/off stand-in glows a blurred copy of the filled part of that control, and it does not show a relative time. Dragging a tile’s brightness, or snapping an on/off tile, updates that stand-in the same way the slider updates the tile. The power button under the slider is round. A one-line hint under the tiles explains the drag. On a circadian scene that hint asks for a solar event or a light until an event is selected.
- **Why:** A removed row was still reading as a dim light, and the level glow did not follow the control it sat behind.
- **Do not reverse without user ask.**

## Tile actions and light-mode depth

- **Date:** 2026-09-23
- **Superseded in part:** 2026-09-23 — plates tuck under the tile with a flat inner edge, hover waits briefly, and select mode does not keep them open.
- **Decision:** Settings and remove share one plate above a member light tile; power is a second plate below it. Both use the group fill. The edge nearest the tile is square, and a tongue of the plate stays under the tile so the plate reads as sliding out from behind it. They move with transform only. Hover waits 200ms; a selected tile opens them immediately. In select mode they stay tucked except on the hovered tile. The selection ring is the frame around the tile: it scales with the tile and paints over the plates. The strip does not grow to make room for the plates; extra scrollport padding is pulled back with a negative margin so the plates can overlap the wheel and the hint. A tile flying between groups is reparented onto the strip for that animation so a group’s backdrop-filter cannot hide it. The color wheel blits its cached bitmap in the same turn it is built, so undo and redo do not flash an empty canvas. A click clears the light selection unless it lands on a tile, a group label, the wheel (including variables and the mode control), or the brightness / on-off stand-in. In light mode the outer color disk, each light group, the brightness slider, the on/off switch, and the selected scene card cast a soft shadow that sits over their glow. Select all is near-white in light mode, and in select mode it uses the same offset ring as a selected light. A scene card shows that scene’s icon, centered across the title and the kind line (`mdi:palette` / `mdi:auto-fix` when none is stored). On a narrow or portrait layout the light strip reaches the page edges.
- **Why:** Hover-only corner discs were unreachable on touch, and a group’s backdrop-filter trapped the move animation. Decoding the wheel image on the next frame painted black first.
- **Do not reverse without user ask.**

## Pin expand, group flight, and shadow

- **Date:** 2026-09-23
- **Decision:** A pin’s teardrop grows and shrinks with the CSS `scale` property, both ways, including group pins and drop targets. Reparenting a pin restarts that transition, so a drop target is appended only on the frame it becomes a target, and a group lead already in the wheel is left where it is. Opening a group shows each member’s icon and flies the pins out from the stack. Leaving the group, or grabbing one member, flies the others back to that stack with their icons still showing. The active pin’s heavy shadow hangs downward (`feOffset dy` negative; the pin body is rotated 180°).
- **Why:** Animating `transform: rotate() scale()` on the SVG did not reverse, and appending the node on every move cancelled the transition before it could be seen. The return flight had no stored home, so leaving the group hid the members in place.
- **Do not reverse without user ask.**

## Picture palette catalog

- **Date:** 2026-09-25
- **Supersedes in part:** “Picture palettes” — the sections are no longer Hearth, Study, Dayroom, and Small hours, and the five colors are room lights for that group rather than samples of the photo.
- **Decision:** The gallery is Daylight, Cozy, Evening, Night, Party, Romantic, Sunrise, and Neon, including Desert sunrise. Wood lamp keeps builtin id `wool` and City rain keeps `rain`, because those photos are the same files. Every other previous picture id is unused, including `blue-hour` (Harbor). The Lofoten picture is `blue-hour-reine`. A palette already copied from a removed picture keeps its colors; its photo and per-slot reset stop resolving.
- **Why:** The pictures and the light colors were chosen together. Reusing an old id for a different photo would change reset on palettes people already saved.
- **Do not reverse without user ask.**

## Picture palettes

- **Date:** 2026-09-23
- **Decision:** The new-scene dialog lists the user’s palettes first, then picture sections (Hearth, Study, Dayroom, Small hours). Each picture’s five colors are sampled from that photo. Choosing a picture saves a new palette copied from it, keeps the photo on that palette’s library chip, and points the scene at the copy. Using the same picture again saves another copy, named with a rising number. A copied palette remembers its `builtin_id`. A slot that no longer matches that original shows the same restore control a scene light uses, and restore puts that one slot back. The palette editor groups its colors the way the light strip groups lights, and Select all scales their brightness together.
- **Why:** A built-in has to stay available to reset against, and each use has to be its own palette so one scene’s edits do not rewrite another. The photographs are credited in `frontend/gallery/CREDITS.md`; the section and palette names are not taken from another app. The palette editor lists that source preset, plus any variables a slot points at, in the same top-left row a scene uses for its palette and variables.
- **Do not reverse without user ask.**

## On/off group and palette base

- **Date:** 2026-09-23
- **Superseded in part:** 2026-09-23 — a custom start stores each area light’s current color and brightness. It does not open them at a default brightness.
- **Decision:** On/off-only lights sit in their own strip group. A new scene asks for a palette base or a custom start. Choosing a palette stores that id and a seed on the scene, and each area light keeps only the palette reference so color and brightness stay inherited. Choosing custom stores each area light’s current state. If a palette was previewed in the dialog, that preview is restored first and the scene keeps the room from before the preview. Editing a light drops the reference and keeps the current values; the remove button becomes reset, which links that light again. The same palette chip as the library list is used in the dialog. Live edit in the dialog previews the palette on the area’s lights, and randomize beside the selected palette changes the seed.
- **Why:** On/off bulbs were sitting in Brightness. A palette base has to stay linked until the user changes a light, or reset has nothing to return to.
- **Do not reverse without user ask.**

## Tile action buttons

- **Date:** 2026-09-23
- **Superseded in part:** 2026-09-23 — a mouse click that only focuses a tile does not open its plates. Keyboard focus does. While the pointer is over one light, every other tile’s plates stay tucked, including the selected one. The plates paint above the hint under the strip.
- **Superseded in part:** 2026-09-23 — each button continues under the tile until it meets the buttons on the other side, so hover and press cover that whole area. The tile face has an opaque surface behind its color wash. Hover waits 500ms, and a selected menu stays open until the hovered menu starts to open.
- **Superseded in part:** 2026-09-23 — the lip sits flush against the tile. Hover and press are continuous from that edge under the tile, with no gap between them.
- **Superseded in part:** 2026-09-23 — the plates sit behind the tile, its drop shadow, and its selection ring. Leaving a hover waits 500ms before the menu tucks, and the selected tile’s menu waits the same 500ms to come back. A click that selects one light moves the menu immediately. Clicking the wheel face clears the light selection; pins and the mode controls do not.
- **Decision:** Open action plates sit flush against the tile, with a square edge toward it, and behind the tile, its shadow, and its selection ring. The visible lip is 36px and scales with the tile frame on hover and when the tile is selected. Icons stay in that lip. Each button’s hover and press run from the lip straight under the tile until they meet the buttons on the other side. The tile’s color wash sits on an opaque surface, so the plates do not show through it while they slide. Hover waits 500ms before a menu opens, and the same 500ms before it tucks after the pointer leaves. A selected menu stays out until another menu starts to open, then waits 500ms to come back after that hover ends. A click that selects a single light moves the menu immediately. Only one light’s plates are open at a time. Clicking the wheel face clears the light selection. Pins and the mode controls do not.
- **Why:** The tucked tongue covered the icons, and a focused selected tile kept a second menu open under the pointer. A highlight that stopped at the lip looked cut off, and the translucent tile showed the plates sliding underneath. Hiding the selected menu at the start of the hover made it disappear before the other one existed.
- **Do not reverse without user ask.**

## Group headers and a second tap

- **Date:** 2026-09-23
- **Decision:** A group header selects every light in that group. When those lights are already all selected, the header removes them and leaves any other selected lights. Cmd, Ctrl, or Shift on the header adds the group, or removes it when every member is already selected. A plain tap still selects one light, and a second tap on that light, when it is the only one selected, clears the selection.
- **Why:** The header was a one-way select-all, and the only selected light could not be cleared by tapping it again.
- **Do not reverse without user ask.**

## Palette base covers the area’s lights

- **Date:** 2026-09-23
- **Decision:** The area passed into a new scene is the area whose lights inherit the palette. A member with no stored color still inherits that palette, in the editor and when the scene is activated. A stored color that is not the palette reference stays an override.
- **Why:** The light list was taken from the scene already open, so the new area’s lights never received the palette.
- **Do not reverse without user ask.**

## Dot hover and group-label icon

- **Date:** 2026-09-22
- **Superseded in part:** 2026-09-23 — hovering a dot no longer closes the selected pins. A plain click still replaces the selection.
- **Superseded in part:** 2026-09-23 — Shift on a disk toggles one light, same as Cmd/Ctrl. Shift range select stays on the light tiles.
- **Superseded in part:** 2026-09-23 — a resting marker is the round dot again (white rim and shadow), not a scaled teardrop. The teardrop is the selected, hovered, or grabbed pin, and the scale and fade run in both directions. A click on a stacked pin opens that group: the lights spread around a circle in the middle of the wheel, the disks dim, and the circle carries a heavy shadow. Grabbing one pin closes the group and drags only that light.
- **Superseded in part:** 2026-09-23 — the resting dot is the earlier marker again: a 12px color fill, a 2px white ring, and the same shadow, with no icon or count inside. Opening a stack grows those lights into pins and moves them from the clicked pin onto the center circle. Undo and redo glide existing pins to the restored spot instead of rebuilding them in place.
- **Superseded in part:** 2026-09-23 — a stack stayed a dot while hovered or dragged, and its count was hidden. The open-group move could paint the pins on the circle without a frame at the clicked pin.
- **Decision:** Hovering a disk dot opens that pin and leaves the selected pins open. Moving away closes only the hover pin. The hover does not change the selection. A plain press selects that light and closes the others. Cmd, Ctrl, and Shift each toggle that disk light. Shift range select stays on the tile list. A resting marker is the earlier round dot: 12px fill, 2px white ring, shadow, and nothing drawn inside it. Selecting, hovering, or grabbing it grows the teardrop pin around the same tip, and that change animates open and closed. Hovering a stack grows that one pin and shows how many lights it holds; leaving collapses it again. Dragging the stack selects those lights and keeps that pin open with the count. A pin close enough that a drop would join it grows the same way until the pointer moves off. A click on a stacked pin opens the group as pins that start on that pin and travel onto a center circle. Grabbing one of those pins closes the group, keeps that pin out of the stack until the pointer is released, and moves only that light. Mode changes, undo, redo, and other moves glide; a drag follows the pointer.
- **Why:** Opening the hovered pin used to move the hit target off the cursor, so the pin keeps a tip hit under the pointer. The old drop animation snapped the scale to 0.7 before growing back, and a separate dot path jumped instead of springing. Shift range select on a disk did not match Cmd.
- **Do not reverse without user ask.**

