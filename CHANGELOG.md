# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Summary:

Scene Studio is easier to start with and safer to share. Give each solar event its own look, choose when lights should follow the sun, and keep your place while editing together.

### Added

- ⭐ Edit with another admin in real time. Their saved changes appear in your open editor; if you both change the same field, choose which value to keep before saving.
- Automatic updates have a Home Assistant switch and a separate interval. Pause individual circadian scenes through an action; activating a paused scene still applies its look once.
- Scene entities expose whether they are active, paused, or currently updating. A new scene takes ownership in its area, while scenes in other areas retain their non-overlapping lights.
- Respect manual changes by default, or choose exceptions that always follow the scene or always respect your changes. Temporarily unavailable lights wait for recovery.
- Latest dawn defaults to 06:00, alongside the existing Earliest dusk setting. Both limits have switches so you can return to solar timing.
- Areas deleted in Home Assistant stay visible with their last known name. Move all their scenes to another area, or delete them together after a confirmation.
- Library guidance, starter choices, and usage counts make color, scene, and circadian presets easier to find and reuse.
- Picture covers and color dots on scene and preset cards show the look before you open it. Circadian scene thumbnails blend the whole day, including the scene’s own event presets.
- On/off lights keep binary controls rather than percentage changes. Hovering a dial ring shows the light's capabilities, and a touch hold opens a scene card's menu.
- The phone's empty Scenes tab includes Auto configure and an outlined Manual configuration action beside it for the current visit. After choosing configuration, its area list includes an Auto configure card explaining what it creates; desktop and Library keep Live edit.

### Changed

- The library now calls shared looks **presets** throughout the editor. New scenes can start from a preset or the room's current lights.
- The selected scene rail stays in place while you switch scenes or presets. The phone dial and light tiles fit together without horizontal scrolling.
- Scene-card palettes sit just below their titles, and preset usage shares a row with the preset controls.
- Scenes and presets share a toolbar, centered preview, and bottom light or slot section on desktop and phone. Changing editor type crossfades the preview while keeping the toolbar and light section in place; same-type dial and disk morphs remain.
- Color presets sit in four responsive columns with two name lines and full-name tooltips. Selection moves neighboring dots aside without wrapping the fourth dot. Select any open preset again to return to the Library overview. Scene cards grow on selection rather than hover, and empty areas omit their scene counter.
- The timeline follows the editor’s shape: beside the preview in landscape, below the toolbar in portrait. It fills the preview stage between the toolbar and light tiles and stays available while a sidebar is open. The sidebar overlays the editor without shrinking it; overflowing light strips gain room to scroll their last tile clear of the drawer. Dial and disk previews keep a usable minimum size, with scrolling when the window is short. Wide editors let the preview extend behind the toolbar.
- Editor links remember Scenes or Library through refresh and Back. Used in menus include each scene’s area.
- Circadian scenes use one solar-event sidebar for all their lights. Select lights from tiles, dial bands, or disk dots; group them, switch color modes, or adjust the selection’s brightness together. The event stays selected when you close the sidebar; select it again or move preview time to deselect it.
- Select a solar event before changing its lights. A short reminder points to the event buttons if you try to edit before choosing one.
- Event sources and individual lights have separate Reset overrides actions. The sidebar explains the current event baseline and lists inherited and overridden values by light. Reset all clears that event’s individual-light overrides in one undoable action, keeping its source and other events; saved effects remain visible and usable, while the effect picker is removed.
- Dial previews can grow to 900px, with consistent space above and below the preview and Now/sun-angle labels on a permanent row below the controls. Toolbars have no shadow ramp.
- Solar events inherit their assigned scene preset per field. Brightness adjustments and randomization belong to that event; explicit light overrides and shared presets stay intact. Event disks show only the selected event’s light assignments.
- Both new-scene preset pickers have more room to scroll. Start from scratch stays the same action, becoming secondary when you select a preset.
- Live edit defaults to on; Reset restores that default in the browser performing the reset.
- Searching for another preview location now explains that Search sends the query and browser IP to Photon (Komoot); the map and optional search remain.
- Project code is available under LGPL-2.1, with separate notices for the bundled SunCalc code and gallery photos.

### Fixed

- Select all uses the same gray default in every editor, and restores it when selection clears.
- Circadian horizons are cleaned up when switching or deselecting editors, including backgrounds left behind by a dial rebuild.
- Scene-card gradients update immediately when their scene preset changes, rather than waiting for another edit or save refresh.
- Saves, Reset, and Auto configure no longer leave half-written scenes or settings after a failure. Migration waits for every required old light scene before converting it or removing managed YAML.
- Scene activation checks caller permissions, reports service errors, and stops an in-flight automatic update when another scene takes over.
- The scene's own event palette wins consistently in the dial, settled preview, Live edit, and the commands sent to lights.
- Ordinary day-position attributes follow local time; explicit preview times land on the right local date through midnight and daylight-saving changes.
- A collaborator's delayed save or deletion no longer overwrites a newer draft or silently brings a deleted item back.
- Loading or refreshing the panel no longer claims that Home Assistant has no areas before the area catalog is available, or leaves the desktop area list empty after those areas arrive.
- Light tiles stay put during selection, brightness changes, and periodic preview updates. Select all stays first in both scene editors and always shows the total light count; unchanged tile paints skip repeated work. Moving a light between disks keeps its tile flight running while color updates continue.
- Scene-preset → circadian-preset navigation removes the old color wheel after the transition, including interrupted navigation.
- Event brightness edits remain local to the scene even without an assigned scene preset. Undo restores the complete previous assignment, and wheel brightness finishes its gesture so changes can save.
- Temperature-only light bands and graphs no longer preview colors the light cannot use. Responsive toolbar controls no longer appear twice when the window narrows, and preset controls stay in the toolbar when a light override is added.
- Activation sends one declared color value to Home Assistant and preserves on/off state when adapting color palettes to temperature lights.
- The preview-date reset icon reserves its own space beside the date suggestions. Interrupted editor navigation keeps the latest destination without removing outgoing preview pixels early or leaving stale light actions behind.

## [6.0.0] - 2026-09-26

### 🚨 Breaking changes

- 🚨 The integration is **Scene Studio** now (domain `scene_studio`, was Circadian Scenes). Your scenes copy over on first load. The old config entry does not — remove it and add Scene Studio once. Search **Scene Studio** in HACS

### Summary:

One sidebar for ordinary scenes and sun-following ones. Start from a picture or a theme, name the room after it, and keep colors in a library you can actually edit.

### Added

- ⭐ New scene from a picture palette, or a circadian scene from a theme preset (Daylight, Hearth, Blue hour). The scene takes that name — and “Name 2” when the room already has it
- Library tab for color variables, palettes, and circadian themes. Edit them in the main column. Delete one from its chip; if a scene still uses it, the dialog stays open and says where
- Palette photos on the theme dial, fading into the next solar event. Brightness darkens the photo and the light tiles that inherit the theme
- Reset a palette slot, or a solar event, back to the preset it was copied from
- Undo and redo in the scene, circadian, palette, variable, and theme editors
- Auto configure: a circadian scene for every area that has lights
- Play a scene live, and set how long that play runs
- Earliest dusk is one house-wide setting, so lights do not dim too early
- Translations for the new editor, in Bokmål, Nynorsk, German, and Spanish

### Changed

- The rail is your scenes, grouped by area, with Library beside it. Sticky titles use the same surface as the app header
- On a phone the wheel stays on screen. Presets scroll in their own row, and a finger on the dial does not scroll the page
- A circadian palette belongs to the solar event. Lights that cannot do color stay off a mixed palette; temperature bulbs only join an all-kelvin one
- Disks restack when you let go of a pin, not while you are still dragging

### Fixed

- Theme brightness stays on the dial and on lights that inherit it — dragging it no longer drops the palette
- Undo brings a palette slot or a variable’s color back
- Rename no longer knocks out the undo tooltip

## [5.0.0] - 2026-09-02

### 🚨 Breaking changes

- 🚨 Integration domain is now **`circadian_scenes`** (was `scene_extrapolation`) — store, entity registry, and panel paths migrate automatically; search **Circadian Scenes** in HACS

### Summary:

Domain rename for real, plus a much better light sidebar: add lights in one tap, effects, live color previews, and fewer dial layout glitches.

### Added

- ⭐ **Add light** under the dial list — pick any light (including other areas); current look is copied into every assigned native scene
- Effect picker in the light sidebar (`ha-control-select-menu`)
- Save warning when a write would change native scenes Circadian Scenes did not create (with a “don’t warn again” option)
- Live kelvin / color readout while dragging the color wheel handle

### Changed

- Light sidebar: undo/redo first, clearer Preview / Live preview / Activate actions, smoother color-wheel live preview (~500ms throttle)
- Dial paints rings from event knots then refines mid-segment colors after settle (faster first paint; truer colors)
- Kelvin scene colors persist with exclusive attributes; table view uses settled HA samples
- Dial chrome: vignette pinned to the panel host, longer sidebar open/close, enter animation orbits event buttons with a shorter sun sweep

### Fixed

- Editor horizontal scrollbar from horizon background bleed (clip at all widths)
- Add light control centering; new lights appear without a full page reload; one tap opens the native search list
- Light-band selection kept when opening the sidebar; Now/Sun° readout alignment; assorted dial layout and bleed polish

## [4.0.0] - 2026-09-01

### 🚨 Breaking changes

- 🚨 Renamed the product to **Circadian Scenes** (domain stayed `scene_extrapolation` in 4.0; search either name in HACS)
- 🚨 Continuous “follow-up” preferences are now **Automatically update lights** (store migrates `continuous` / `follow_up` keys for you)
- 🚨 Nightlights mode is gone — use a normal native scene + automation if you still need that pattern

### Summary:

Built-in sun-following updates, dial as the default editor, and a much calmer day/night look — plus a pile of editor fixes so Live edit, drafts, and the light rings behave.

### Added

- ⭐ Built-in **automatic light updates** (on by default): after you activate a circadian scene, lights keep adjusting on an interval with a matching transition — pause per room from the list, or set the global interval to 0
- Auto-setup creates one native scene per solar event, named after the event (`{area} Dawn` …); combined day slot is `{area} Dawn-Sunset`
- Empty list / created-scenes copy for Circadian Scenes, plus RGBWW color/white brightness graphs in the light editor

### Changed

- Dial view is the default for new users (explicit Table choice in localStorage still wins)
- Scene list is a single table with area groups and the auto-update control at the top; friendly names everywhere
- Chromatic color blends (HS/RGB) stay on the **wheel rim** instead of cutting through white; wheel path drawing matches
- Dial chrome: multi-color dusk horizon into the surface, theme-split night wedges, softer vignette, portrait toolbar that pushes the dial instead of covering it
- Create wizard “full automatic” fills all five solar events (not a combined switch)
- Hide-managed native scenes defaults to on for new installs (migrated stores flip with 3.0)

### Fixed

- Live edit no longer sends two Color descriptors to `light.turn_on` (hs + rgb) — HA rejected that exclusion group
- Refresh on `#new` restores the local draft instead of wiping post-wizard work
- Sun/handle drag hits no longer steal clicks from the light rings
- Draft/location banners shrink the dial so the light list still peeks; vignette lines up with the horizon wash under banners
- Panel boot / Store migration / auto-update stop control; dial overnight wrap and date morph; scrub-release refine flash; list flicker and unavailable lights; horizon fill with sidebar open; brightness-graph label collisions; and assorted dial layout/scroll/chrome glitches

## [2.2.0] - 2026-08-30

### Added
- Sidebar panel: add Circadian Scenes once; rooms are created and edited there (legacy per-room config entries import automatically)
- Solar dial view: concentric light rings, year scrub with client-side sun math, landscape timeline rail, soft ring glow, and dial chrome (ticks, event buttons, sticky scrub, enter animation)
- Create-scene wizard: Automatic (Bright/Dimmed/Low lights) or Manual with config-flow-style guidance, native scene pickers (empty = create automatically), brightness-ranked defaults; block areas with no lights
- List page: Extrapolation / Created scenes tabs (`ha-tab-group`), global settings sidebar (hide created scenes in the HA UI), row settings/delete on both lists, New FAB on both tabs
- Panel translations for English, Bokmål, Nynorsk, German, and Spanish (`frontend` + config)
- Table/list sun path chart with a solid day stroke, horizon color ramp, and dial-style event markers (inert on the list)
- Fast list sun chart via the lightweight `sun_path` API (full `preview` stays on the editor)
- Dial light list as HA-style cards with entity state icons; suggested area lights when a new scene has an area but no native scenes yet
- Light-edit sidebar: brightness graph + Huemane-style color wheel (no On/Brightness fields); legend/ring clicks open the same sidebar
- Unsaved editor drafts persist in the browser with a restore banner; leave prompts Discard / Keep editing
- Preview another location; year-long date scrub; Live edit; undo/redo

### Changed
- Configuration home is the sidebar panel; the options flow is gone on purpose
- New-scene Save FAB is always visible; existing scenes still show Save only while dirty (dialog on first create, immediate save after)
- Cross-mode color blends (e.g. color_temp ↔ HS/RGB) lerp in RGB instead of flipping mode at 50%
- Dial/table layout: light list under the face; fixed desktop chrome; portrait date/scrub overlay; landscape rail top inset; horizon/bloom can paint under the desktop sidebar
- Leaving with unsaved work prompts Discard / Keep editing while still buffering drafts for refresh/remount
- CI workflows target `master` (was `main`); lint runs on Python 3.14 so PyPI Home Assistant matches current APIs

### Fixed
- Create save no longer opens the Unsaved changes dialog when navigating to the new scene
- Settings hide toggle refreshes the list without closing the settings sidebar
- List sun path no longer races a full editor preview (slow / intermittent chart)
- Dial polish: ring selection flash, hover name placement, horizon glow peach↔sky blending, scrub corona trails, dusk clamp link during year scrub, sun outline during scrub, and related layout/clipping issues

## [2.1.0] - 2025-12-21


### Added

- Expose scenes the extrapolation scene consumes as attributes

### Changed

- Combine Dawn/sunrise/sunset instead of dawn/dusk and sunrise/sunset (makes more sense in real-life)

### Fixed

- Opening options flow with legacy data causes error that hinders fixing legacy data
- Remove none values from service calls. Eg. effect: none is not supported


## [2.0.0] - 2025-11-04

### 🚨 Breaking changes

Breaking changes are marked with an emergency light emoji: 🚨

### Summary: Improved UX and minimize the time to setup!

This release's focus is on improving the UX and minimize the time it takes to set up the integration - but there are also lots of other goodies!

### Added

- 🚨 Add noon scene option
- ⭐ Modify transition progress - ie. move the transition towards or further away from the noon scene (to increase/decrease the brightness)
- Improved extrapolation speed by running calculations in parallel
- Add support for extrapolating effects!
- Added testing tools in the service. Select:
  - **Time and date** - Test how the lighting would look at a specific time of day - or year (winter/summer)
  - **Location** - Test the lighting as if you are at a different place in the world
- Translations! Proper Norwegian (nynorsk) and Danish-Norwegian translations has been added alongside German
- Added handling for if the sun doesn't rise/set (Polar regions etc)

### Changed

- 🚨 Removed night rising and night setting options
- 🚨 Renamed sun setting and sun rising to sunset and sunrise
- 🚨 Renamed all entity variables, meaning the only user (me), has to reconfigure all the integration entries - wohoo!
- Simplify configuration by optionally combining dawn/dusk and sunrise/sunset scenes
- New default scene name: Extrapolation scene -> Automatic Lighting
- Updated integration name: Circadian Scenes -> Circadian Scenes (Circadian Rythm)
- Make the nightlights boolean and nightlights scene optional
- Mark required and optional fields
- Move nightlights configuration into its own config step to make the config less overwhelming
- No longer store area_id in the configuration. Instead just assign it to the scene entity and fetch it from there (to always keep it up to date).
- Hide scene name and area from the options/edit flow (this should be edited directly on the scene entity)

### Fixed

- Changes to `Earliest time for triggering the dusk scene` wasn't saved
- Updated issue and documentation URLs
- Stopped using the soon to be deprecated `color_temp` argument in `turn_on` service
- Inaccurate extrapolation calculation
- Transitions crossing midnight was wrongly calculated or outright failed

## [1.0.0] - 2025-10-17

### Added

- First official release of Circadian Scenes custom component
- No more direct file access of scenes.yaml
- New service! extrapolation_scene.turn_on: activates a extrapolation scene with a basic brightness modifier
- New attribute: brightness_modifier - keeps track of the applied brightness_modifier
- New attribute: integration=circadian_scenes - makes extrapolation scenes easily identifiable in Home Assistant's templates
- Add support for RGBW
- Add support for RGBWW

### Changed

- Improved two-step config flow for easier setup and changes
- Use fully featured Home Assistant dropdowns during setup (displays eg. the selected scene's icon, assigned area etc)
- Filter scene selectors during setup to only show scenes assigned to the selected area (if an area is selected and has scenes assigned to it)
- Only send one request with all changes to the lights. Faster, but not supported by eg. some older zigbee lights

### Fixed

- Integration is blocking the thread - must use async (minor issue)
- Remove deprecated constants

## [0.0.1] - 2024-01-01

### Added

- Initial implementation of Circadian Scenes
- Dynamic scenes with lighting is based on sun elevation
- Configuration flow for Home Assistant
- Support for multiple scenes
- HACS compatibility
- Support for transition time
