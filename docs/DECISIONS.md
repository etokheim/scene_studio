# Current decisions

Durable product and architecture guidance for Scene Studio. Keep current constraints and their reasons; delete superseded decisions when changing course. Git preserves history. Do not reverse an intentional product decision without the user's request.

## Shared editor regions and retained preview pixels

- **Date:** 2026-09-30
- **Decision:** Scenes and library editors use one shell with toolbar, flexible preview, and bottom light or palette-slot region. Existing editors own their data and interactions. Incompatible previews retain live outgoing DOM, canvas pixels, backgrounds, and measured geometry until the incoming content is ready and the crossfade finishes. Toolbar and light hosts survive; destination controls and callbacks replace their contents. Revision gates prevent interrupted transitions and delayed navigation from cleaning up or reopening an older destination. Same-type morphs remain.
- **Why:** Separate editor layouts reserved different space below their disks, and teardown before the exit animation finished caused visible jumps. Cloning a canvas would lose its pixels; retaining old light callbacks would act on the previous scene.

## Library onboarding and shared selection opacity

- **Date:** 2026-09-29
- **Decision:** The library explains reusable presets with an information icon and offers creation buttons for each empty preset category. Creating a circadian preset opens the starter chooser even when the library is empty. Default remains a starter, adopted when requested or by Auto configure; loading an empty store does not create it. Reset removes scene and circadian presets and restores five default colors. The scene tab adds 8px below Live edit, and dusk has one title and a 4px gap above its field. Color-preset rings retain their offset and share 75% opacity with scene cards.
- **Why:** Explain the effect of shared edits and keep an empty library useful without silently adopting a circadian preset.

## Selected scene card styling

- **Date:** 2026-09-29
- **Decision:** The selected scene card shows its palette below its title. Selection scales the card; hover only changes its shadow and menu reveal. Palette dots are 18px with 2px overlap, a 0.5px inner white border at 15% opacity, and a shadow under the stack. The 2px selection border sits outside the card with a 2px gap and uses 75% white.
- **Why:** Finish the requested scene-card styling without changing the Default starter behavior.

## Default is a starter, and selected rings share 75%

- **Date:** 2026-09-29
- **Decision:** Opening the integration does not create the Default circadian preset. A fresh store and Reset still install the five default colors. Reset removes scene presets and circadian presets. Default is the first starter preset. Adopting it, creating a circadian scene from scratch, or running Auto configure adds that preset (and any missing seed colors) and uses it. A v3 upgrade still seeds it, because those scenes already use theme id `default`. An existing theme with that id is not overwritten. The selected color-preset ring and the selected scene-card ring both use `--selected-ring-color` at 75% white. The color-preset ring is inset `-6px` (a 2px border, then a 2px gap outside the preset’s own 2px border). In light mode the color-preset ring is the primary color at 75%.
- **Why:** The library was never empty of a circadian preset, so the starter list had no Default and Reset described a preset the user had not chosen. The two selection rings had drifted to different opacities, and the color-preset ring sat on the pill.
- **Do not reverse without user ask.**

## A selected color preset is a pill

- **Date:** 2026-09-28
- **Decision:** A selected color preset grows from a 40px circle to an 80px pill with a 20px corner radius. It does not scale up. The white ring sits outside the fill. The overflow menu is a 32px circle, 4px inside the pill, and fades in on the right half. Reset to preset default is a plain text button beside the source chip, and it is hidden while the copy still matches the gallery preset. “Used in N scenes” is a plain text button too.
- **Why:** Stretching the circle with an inset border covered the color and left no room for the menu. A bare text node had no hover or press state. The reset action was always on screen, including when there was nothing to restore.
- **Do not reverse without user ask.**

## Leftover lights fly; a settled dial matches the card

- **Date:** 2026-09-28
- **Decision:** When two simple scenes share no lights, leftover pins and tiles pair in list order after the entity-id match. The first leftover pin and tile take the new title, brightness, and color. Only a true extra fades in or out. A settled circadian dial resamples from the theme plus per-light overrides (`intermediatesPerSegment: 5`), the same path as opening a solar event. A gallery scene or circadian preset leaves the starter list once any library item has that `builtin_id`. An in-flight save does not write `_editId` or `_themeId` after the editor has moved on. Clicking a scene card highlights it before the scene fetch returns, including while a solar-event sidebar is closing.
- **Constraint:** Mid-scrub uses event knots plus midnight wrap and client sun geometry. Settled preview restores authoritative HA blend samples (five intermediates per segment), not CSS RGB chords. Client kelvin display conversion uses Tanner Helland to match Python; HA picker conversion is wheel chrome only. Date/chip changes walk intermediate calendar days before Astral reconciliation so dusk ghosts do not teleport.
- **Why:** Id-only morph faded every pin when the area changed. The preview sample grid stayed a warm wash until a solar event forced the event resample. Adopting a starter twice was easy because it stayed in the gallery. Closing the solar-event sidebar saved the previous scene after the next card was already open, so the rail kept the old selection.
- **Do not reverse without user ask.**

## A phone dial shrinks; presets are the user-facing names

- **Date:** 2026-09-28
- **Decision:** On a phone the circadian face is centered in the space above the light tiles and may shrink below the color-wheel floor so the page does not scroll. A wide dial keeps that floor. The face is vertically centered between the shared toolbar and light section; the play row and date chips stay in layout flow. Light tiles are grouped again whenever a selector sits on the strip outside a group. The narrow overflow menu holds Live edit; undo and redo stay as header buttons. Library copy says scene presets, color presets, and circadian presets. Stored kinds stay `palette`, `variable`, and `theme`.
- **Why:** A matching group signature left a rebuilt tile list flat. The floor plus a scrollbar hid the tiles on a short phone. Palette, variable, and theme did not say how the three lists relate.
- **Do not reverse without user ask.**

## Scene changes keep the dial and one rail paint

- **Date:** 2026-09-28
- **Decision:** Circadian scene to circadian scene leaves the dial mounted and lerps the new path. The preview key includes the scene and its theme, so two scenes in one area do not keep each other's ring colors. The list rail is not rebuilt for that switch. A hash write is handled once: Home Assistant fires both `hashchange` and `location-changed`. The exit layer strips leftover enter classes before it scales away. A scene card can be opened again after it is deselected, because that card stays in the rail.
- **Why:** Forgetting the dial popped the rings and tiles. A second hash pass rebuilt the editor while the first animation was still running, and a leftover enter class restarted scale(0.92) inside the exit.
- **Do not reverse without user ask.**

## Phone content clears the home indicator

- **Date:** 2026-09-27
- **Decision:** The page shell stays `100vh` and full-bleed. The scene list, the circadian light tiles, and the simple editor add bottom padding from `--safe-area-inset-bottom` / `env(safe-area-inset-bottom)`. That pad is inside the scroller or under the tiles, not on `.page`. The phone rail has no bottom border.
- **Why:** `100vh` includes the iOS home indicator, and a pad on the overflow-hidden page shrinks the flex box and clips the workspace. Activity clips the same way; Energy does not, because its scroller clears the inset.
- **Do not reverse without user ask.**

## Desktop header stays put; Live edit sits on the list

- **Date:** 2026-09-27
- **Decision:** On a wide layout the header is always undo, redo, and settings. Live edit is the first item inside each rail tab, under the tab bar, and it shares the `roomPreview` preference with the create dialog’s Live preview. A narrow editor hides the rail. Live edit for that editor is in the header overflow menu (see “A phone dial shrinks”). Settings opens over whichever editor is in the main column and is not closed when that column changes. The drawer’s exit transitions opacity and transform for the same duration as the entry. Area titles show how many scenes that area contains.
- **Why:** The header was swapping actions every time a scene opened, and the settings drawer vanished because only transform was eased.
- **Do not reverse without user ask.**

## Level-only lights are white

- **Date:** 2026-09-27
- **Decision:** On/off and brightness-only lights paint white, scaled by brightness. Off stays the gray tile. Applying a palette does not write `rgb_color` onto those drafts. A light group is omitted when any of its members are also listed. Hide members hides the bulbs, so the group stays. Stored membership is not rewritten.
- **Why:** Those tiles were picking up palette color. A group plus its bulbs applied the same lights twice.
- **Do not reverse without user ask.**

## Scene selection keeps one rail and one motion

- **Date:** 2026-09-27
- **Decision:** On a wide layout, moving between the scene list and a scene editor does not rebuild `.area-rail`. Selection is the live `.selected` class, not the flag from when the card was built. Wheel pins and light tiles morph by entity id, and a pin move uses the Web Animations API. On a narrow dial, date chips are hidden, the date returns to today, and Play scene live is a header menu item. On a wide landscape dial, the play/chip row overlays the face so the dial can grow into that band.
- **Why:** A stale selected flag reloaded or left the scene, which restarted the scale. Index-matched tiles and an untransitioned pin attribute jumped backward, then forward. Rebuilding the rail on deselect cut the scale off halfway.
- **Do not reverse without user ask.**

## Edit to edit keeps the scene rail

- **Date:** 2026-09-27
- **Decision:** On a wide layout, `#edit/A` → `#edit/B` keeps the existing `.area-rail`, updates selection in place, and swaps the stage. It does not recenter the list. The rail scrolls to the open card only when that card is outside the scrollport, and only on first open or when arriving from the list or the library. The card is found by `data-scene-id` / `data-item-id`, because `.selected` is added a frame later so the scale can transition.
- **Why:** Rebuilding the rail started it at scroll 0, so the reveal treated an on-screen card as off-screen and jumped. The late selected class also flashed the dimming.
- **Do not reverse without user ask.**

## Selecting in the library does not scroll the rail

- **Date:** 2026-09-29
- **Decision:** On a wide layout, choosing another color preset, scene preset, or circadian preset while the library tab is already open keeps `.area-rail` and leaves its scroll where it is. The rail scrolls to the open item only when that item is outside the scrollport, and only on first open or when arriving from the scenes tab.
- **Why:** Rebuilding the rail started it at scroll 0, so the reveal treated an on-screen card as off-screen and jumped. Same rule as scene-to-scene.
- **Do not reverse without user ask.**

## A selected preset card shows its palette

- **Date:** 2026-09-29
- **Decision:** Selecting a scene preset card, or a scene that uses one palette, reveals that palette as five overlapping color dots above the title. The dots are the resolved slots, in order, later slots on top. Each dot is 18px, overlaps the next by 2px, and has a 0.5px white inner edge at 15% opacity. The gap where they meet is a mask in the dot underneath, so the card shows through. The stack has one drop shadow. Circadian scenes stay title-only; they have a palette per solar event, not one preset.
- **Why:** The cover is a photo or a blend. The slots are what the preset assigns.
- **Do not reverse without user ask.**

## Scene cards scale, and their menu matches the library


- **Date:** 2026-09-27
- **Decision:** Scene cards and library square cards share one overflow. It stays hidden until hover on a fine pointer, a 500ms touch hold, or keyboard focus. While that menu is open the slot keeps pointer events, because the menu hangs outside the card and inherits `pointer-events` from the slot. A tap still opens the card. Selected scale is 1.1 and hover is 1.06, both in 120ms. The selected class is added on the frame after first paint, because the card is created in that state and a same-turn class never transitions. The selected ring is a 2px border at 75% white, then a 2px gap, then the card. The corner palette photo has no drop shadow. Card padding contains the 1.1 scale so a horizontal scene row does not grow a vertical scrollbar.
- **Why:** The scene list kept the menu visible while palettes hid it. The scale was applied before the first paint, so it popped. The photo shadow sat on top of the image.
- **Do not reverse without user ask.**

## A scene’s palette photo is an attribute, not the icon

- **Date:** 2026-09-27
- **Decision:** When a scene’s palette is a shipped picture, the scene entity gets `palette_image` — a stable `/api/scene_studio/gallery/<id>.jpg` URL. A circadian scene also gets `palette_images`, one entry per solar event that has a photo. `palette_image` is noon when that event has one, otherwise the earliest event that does. The scene icon stays an mdi name. Dashboards that want the photo read the attribute.
- **Why:** Home Assistant’s icon field cannot be a photo. The versioned panel asset URL changes whenever the frontend rev bumps, so a card pointed at it would break.
- **Do not reverse without user ask.**

## Dial touch does not scroll, and the sky stays on the dial

- **Date:** 2026-09-25
- **Decision:** The dial face uses `touch-action: none`. A touch that starts there scrubs light bands, and `preventDefault` runs only while the `touchmove` is still cancelable. On a narrow page the horizon wash stays inside the face and is positioned from that face, so its center is the dial. On a wide stage it stays on `.stage-bg` and tracks the face while the stage scrolls. Beside the disk, color modes stay fixed; only variables and palette colors scroll, and the fade mask belongs to that scroller. A selected palette uses the same selection ring as the other modes. Library section titles use the area-title ramp and stick flush to an unpadded rail.
- **Why:** `touch-action: pan-y` let the page start scrolling, after which canceling `touchmove` was ignored. A page-sized sky layer with page coordinates put the wash under the light tiles on a phone. Sticky color modes and a padded library scrollport left the fade and the titles short of where they belong.
- **Do not reverse without user ask.**

## Circadian palette belongs to the solar event

- **Date:** 2026-09-25
- **Decision:** In the circadian editor a palette is chosen on the solar event, not on a light. The light’s color wheel offers palette mode only when that event already has a palette, and it uses that palette. The name-scene button paints above the light tiles. Around the dial, the brightness span is half of 92px on a phone-sized face and three quarters on a desktop face, and the hour numerals are 8% of the face width.
- **Why:** A light was able to pick its own palette. A fixed brightness span and two label sizes left the dial small on a phone and awkward in between.
- **Do not reverse without user ask.**

## Narrow editor fills the screen; the wheel does not scroll the page

- **Date:** 2026-09-25
- **Decision:** On a narrow panel the simple editor and the circadian dial fill the shell. The light tiles stay at the bottom. The color wheel and the dial face grow into the space above those tiles. The color wheel does not grow past that space, so its page does not scroll. A wide dial uses the same 400px floor as the color wheel. A narrow dial may shrink below that floor so the tiles stay on screen (see “A phone dial shrinks”). The disk keeps 16px at each side. On a phone the palette split and source/uses controls are one horizontal strip above the disk, with 8px under the header, so the disk sits below them. Selecting a light fades those source/uses controls out and fades the color modes and variables into the same band, over the disk, so the disk does not move. That band stays horizontal for the whole narrow range. The beside-disk column is only for the wide stage; using it on a narrow panel made the presets jump as the window passed about 800px. Wider screens keep those controls as a vertical overlay. When the wheel group is shorter than the space above the tiles, it is centered. The name-scene button floats over whatever is underneath. The list view still scrolls inside the rail.
- **Why:** A fixed wheel left the tiles mid-page. Growing the disk to the raw leftover width clipped the rings and dropped the presets onto the tiles. Lifting the tiles for the name button left a gap the wheel should have used. The dial’s 600px floor scrolled sooner than the color wheel and left the tiles under the face instead of on the bottom of the column.
- **Do not reverse without user ask.**

## On/off and brightness-only lights stay in their own groups

- **Date:** 2026-09-27
- **Decision:** An on/off light stores `{state}` only, and its tile is empty or full. A brightness-only light keeps brightness and drops color. Both are grouped by capability before any palette or color draft, including a new circadian scene and auto-configure. Preview samples use the same adaptation as the saved snapshot.
- **Why:** Those lights were painted with the theme color and a percent fill, and they joined the color group.
- **Do not reverse without user ask.**

## Sticky titles do not depend on scroll-state queries

- **Date:** 2026-09-27
- **Decision:** Floor and area title fills toggle `.is-stuck` from the rail’s scroll position. The same background the scroll-state query paints is also painted from that class. A stuck light-group title uses a solid gradient, not a masked backdrop filter. Wheel pins set an SVG `transform` attribute so the icon is not painted at the origin.
- **Why:** Safari ignores `@container scroll-state(stuck)` and paints `foreignObject` icons at the SVG origin when the pin position is only a CSS transform on an ancestor.
- **Do not reverse without user ask.**

## Reset restores a fresh install

- **Date:** 2026-09-27
- **Decision:** Settings can delete every Scene Studio scene and its Home Assistant scene entity, remove managed native YAML leftovers, clear the activation cache, and rewrite the store to five seeded colors, no scene/circadian presets, and default settings. The config entry, lights, and areas stay. The panel then drops its `scene_studio` drafts.
- **Why:** There was no way back to the empty onboarding store without editing storage by hand.
- **Do not reverse without user ask.**

## Scene from a palette takes the palette name

- **Date:** 2026-09-25
- **Decision:** A simple scene created from a palette is named with that palette’s name. If the area already has a scene with that name, the next one is “Name 2”, then “Name 3”. Another area can reuse the same name. Starting from none stays Untitled.
- **Why:** The new scene was always Untitled, so the palette you just picked did not show up in the area list.
- **Do not reverse without user ask.**

## Circadian scene from a theme takes the theme name

- **Date:** 2026-09-25
- **Decision:** Creating a circadian scene opens a theme picker: saved themes, then the shipped presets (Default, Daylight, Hearth, Blue hour). A preset is copied into the library with `builtin_id`, and each palette it is based on is copied the same way picture palettes are. The scene is named with that theme’s name, then “Name 2” when the area already has it. Custom stays on the Default theme and is Untitled. A solar event that no longer matches its preset can be reset in the theme-event sidebar. The theme dial shows a palette’s picture on the arc from that event to the next, fading out along the arc.
- **Why:** Circadian create skipped the picker and always started Untitled on Default. A copied theme needs the preset id so a later change to one event can be put back, and the picture already lives on the palette.
- **Do not reverse without user ask.**

## Domain and repo rename to scene_studio

- **Date:** 2026-09-25
- **Decision:** Rename from `circadian_scenes` to `scene_studio`. On first load, copy `circadian_scenes.scenes` (or, if that is empty, `scene_extrapolation.scenes`) into `scene_studio.scenes` when the new key is empty. Purge entity-registry rows on both old platforms. Panel `localStorage` falls back through those domains once. Config entries on an old domain do not auto-load — remove the old entry and add Scene Studio once. No dual-domain stub. The next release is a major.
- **Why:** The product is the scene editor, not only circadian scenes. Scene Studio was free as a Home Assistant domain and as `etokheim/scene_studio`. The same words exist for unrelated 3D, video, and photo tools; they do not collide inside Home Assistant.
- **Do not reverse without user ask.**

## Disk focus changes when the pin is released

- **Date:** 2026-09-24
- **Decision:** Crossing from one disk to the next resists by the same inset past the shared edge, including palette. The pin may hop during the drag. The disk stack and which disk is in front stay as they were until the pointer is released. On release, the disk under the pin takes focus and the others animate into the new stack.
- **Why:** Restacking on the way across moved the edges under the pointer, so the resistance only existed for the first hop.
- **Do not reverse without user ask.**

## Palette colors sit above variables; used chips overlay

- **Date:** 2026-09-25
- **Decision:** Color-mode buttons and the variable list appear only after at least one light is selected. They fade and travel 24px: in the horizontal bar, modes come from the left and variables from the right; beside the disk the whole column comes from the right. The reverse plays on the way out. The aside column uses the list’s intrinsic width, so narrowing the window returns to the horizontal bar. While palette mode is active, that palette’s five slots are a titled list above the variables, with a divider under the slots. On a wide panel, source/uses controls are a vertical overlay so they do not move the wheel or the dial. On a narrow panel, `.page` has no inline padding.
- **Why:** The selection ring was clipped and the hover transform shoved the selected row. A palette disk had no slot list. The used-item row was still taking height on the dial, and the 12px page inset kept the mobile editor off the screen edge.
- **Do not reverse without user ask.**

## Preset uses are one menu

- **Date:** 2026-09-29
- **Decision:** A library editor keeps the source chip (the preset this copy is based on). Scenes that use it are the “Used in N scenes” button, not a second row of chips. A scene keeps its theme or scene-preset split. Other presets it uses directly are one button: “Uses N scene presets”, “Uses N color presets”, or “Uses N presets” when both. The menu row shows a color dot, a preset photo, or a preset gradient; a scene row shows that scene’s preset photo or gradient. The empty scene-preset control in the mode pill is the same dashed plus as “add color preset”, in the text color. The hue-preset row lists only presets the selected lights can use. A mixed selection still shows a preset when any selected light can take it, and applying it skips the lights that cannot. Clearing a scene preset updates that scene card’s photo before the list reload.
- **Why:** The used-in button was painted on top of the chips it replaced. The color dots had grown, and then scaled again, to fit a full-size overflow button. A temperature bulb was offered color presets, and clearing a preset left the photo on the card until the next reload.
- **Do not reverse without user ask.**

## Theme split and palette mode button

- **Date:** 2026-09-25
- **Decision:** The split button selects a simple scene's base palette or a circadian scene's theme; its pencil opens that item. Randomize changes the palette assignment seed. A simple scene stores `palette_id`; a circadian scene has one theme and per-event `event_palettes`. Other used presets appear in the single uses menu, and library editors show the source plus “Used in N scenes”. The mode pill's palette face switches the disk; without a palette it shows a dashed plus. Selecting a circadian palette belongs to its solar event, never an individual light. Opening a chooser from an existing editor must not create a scene.
- **Why:** The corner control was the palette, so the theme had no switcher, and a scene with no palette had no way to pick one from the mode row.
- **Do not reverse without user ask.**

## Scene base palette is a corner split button, not a preset

- **Date:** 2026-09-24
- **Decision:** The hue-preset track lists color variables only. Custom/None starts or clears a simple scene's base palette. `palette_id` and `assignment_seed` belong to a simple scene; circadian palettes belong to `event_palettes`, not the shared theme or scene `palette_id`. The mode pill keeps every disk visible, dimming unsupported modes with “Not supported”. On/off and brightness-only selection replaces the disks with native controls. Stacked disks share the same shadow. Opening a chooser from an existing editor must not run the create path.
- **Why:** Palettes were a second kind of preset, and the pill hid disks the user still needed to see. The circadian store had no per-event palette, so the button could not be wired without that field.
- **Do not reverse without user ask.**

## A pin grows only after its dot has been painted

- **Date:** 2026-09-24
- **Decision:** Hover, click, tile selection, and group open/close share one pin grow: the `.pin-body` scale, played backwards on collapse. Add `.expanded` on a frame after the dot is painted. Do not move the pin in the SVG in that same turn. An already-open pin stays put while another dot grows. Group flights use that same duration and curve.
- **Why:** The first hover, and any hover while another pin was open, moved the node in the same turn as the class change, so the scale transition never started. Group open used a different flight.
- **Do not reverse without user ask.**

## RGB-only bulbs skip a palette that mixes kelvin and color

- **Date:** 2026-09-24
- **Decision:** A bulb that can do both color and kelvin can sit on any palette. An RGB-only bulb joins a palette group and disk unless the palette mixes kelvin and chromatic slots; then it stays in the color group. Temperature-only bulbs still join only an all-kelvin palette.
- **Why:** An RGB-only bulb cannot show the kelvin slots of a mixed disk, the same way a temperature bulb cannot show its chromatic slots.
- **Do not reverse without user ask.**

## Temperature bulbs use a palette disk only when it is all kelvin

- **Date:** 2026-09-24
- **Decision:** Dual-capable color/kelvin bulbs linked to a palette stay in its group and disk; RGB-only bulbs skip mixed kelvin/chromatic palettes. Temperature-only bulbs join that group only when every palette slot is kelvin. On a mixed palette they stay in the temperature group and on the temperature disk; dragging there stores kelvin and drops the palette link. On/off and brightness bulbs never join a palette group.
- **Why:** A temperature bulb cannot show the RGB parts of a mixed disk, and approximating those parts while dragging hides the palette the other lights are using.
- **Do not reverse without user ask.**

## Palette lights share a named group and the palette disk

- **Date:** 2026-09-24
- **Decision:** A palette-capable light whose draft references a palette is grouped under that palette’s name, ahead of the color/temperature/white/brightness/on-off groups. Selecting that light shows the palette disk. A color or temperature choice stays on the light it was made for, so the next palette light is not left on the RGB disk. The selection ring is drawn outside the tile and scales with the tile (press and jelly), over the action plates. Pin moves after the first pose glide; a drag still follows the pointer.
- **Why:** Palette lights were filed with their sampled color mode, and a previous disk choice kept them on RGB. The ring lived on the frame while the tile scaled, so it sat flush and stayed still. Pins snapped because a later sync cleared the CSS transition before it could run.
- **Do not reverse without user ask.**

## First column is the scene list; library is a second tab

- **Date:** 2026-09-24
- **Decision:** The area rail opens on Scenes; scene presets, color presets, and circadian presets share Library. Selecting a scene dims the rest of the rail until hover; the hover rule outranks dimming. Source and uses controls overlay the editor corner instead of consuming a toolbar row. Opening a referenced item switches to its library editor and reveals it only when needed. The circadian readout is created with the dial. Library delete asks for confirmation and the store rejects removal while any scene, theme, or palette references the item, including per-event palette references.
- **Why:** The scene list was buried under the library. Used items need a way back to their editors without hunting the column.
- **Do not reverse without user ask.**

## Next-day solar dusk sits after midnight on the 24h clock

- **Date:** 2026-09-09
- **Decision:** When astral dusk is already on the next calendar day, store it as wall-clock seconds (`solar % 86400`) so the dial/chart marker is in the morning after midnight (e.g. 01:00), not pinned at 24:00. Earliest-dusk still only *delays* a same-day solar dusk before the floor; it does not pull a next-morning dusk back to 22:00. Keep events in solar order (dawn→dusk); do not sort by clock seconds. `current_sun_event_index` unwraps a backward dusk time so sunset→dusk and dusk→dawn use the existing midnight-wrap progress math.
- **Why:** Late-summer dusk after midnight is a real solar time. Clamping to 24:00 made dusk look like end-of-day and skipped the sunset→dusk hour that actually falls after 00:00.
- **Do not reverse without user ask.**

## Light sidebar edits write per-event overrides

- **Date:** 2026-09-09
- **Decision:** Light-edit drafts are keyed by **solar event id**, not a shared native scene entity. Each graph/wheel point writes `formData.overrides[light][event]`. Native-draft flush skips the circadian entity id. The sidebar brightness graph is a **piecewise-linear** polyline through event knots (same lerp as runtime; midnight wrap split so 24:00 stays on the right edge; fill down to 0%). The dial brightness loop stays a **cosmetic linear** stroke in **polar clock space** (linear seconds around midnight, linear radius) so dusk→dawn follows the rim instead of a Cartesian chord.
- **Constraint:** Sidebar chips are one per solar event and graph focus follows event id. The graph is a fixed 120px high with a responsive viewBox; colliding event labels stagger without moving their true-time handles. Missing-event handles select the event rather than adding membership. Dual-capable lamps use stacked color/kelvin wheels; mixed kelvin band is about 19% of the radius. A full kelvin disk keeps a drop's horizontal offset while vertical position chooses temperature; an outer kelvin ring rests on its track centerline. Disk focus changes on release, not during the crossing. Wheel path smoothness uses denser sampling of the same runtime blend, never a different blend rule.
- **Constraint:** Live `light.turn_on` sends exactly one color descriptor (rgbww → rgbw → hs → rgb → kelvin). Drafts may hold redundant color representations, but the HA service rejects them together.
- **Why:** After v4, `_eventSceneId` fell back to the one circadian entity for every event, so one draft moved all five handles and `apply_native_drafts` never persisted the look. Per-event overrides are the store model; a shared native scene id is not.
- **Do not reverse without user ask.**

## Dial brightness: radial event buttons + override-style curve

- **Date:** 2026-09-09
- **Decision:** Solar-event brightness is radial: 0% sits on the sun path; 100% uses the configured outward span, half of 92px on phone-sized faces and three quarters on desktop. Do not drag inside the path. Buttons, spokes, and a quiet cosmetic linear polar loop wrap dusk→dawn in solar order. The stroke is about 0.32 opacity and fill at most 0.08; light-mode fill is black at 5% near the path, transparent at 100%. Activation uses linear event interpolation too. With a light selected, dragging writes that light's per-event override; otherwise it writes theme brightness. A tap opens the sidebar and brightness changes only after 10px movement. Labels are name · time plus percent, not per-event native scene names. Subject changes ease radii; live drags follow the pointer immediately. Cardinal hour labels are regular-weight serif, sized at 8% of face width; the other 20 ticks retain desktop/mobile sizing. Time-override glow preserves direction past 12h.
- **Why:** Brightness lived only in the sidebar graph. Putting it on the dial makes the day loop visible next to color rings, and matching the override chrome keeps “white line + fade” as one visual language.
- **Do not reverse without user ask.**

## Stage chrome: background glow vs scrolling column

- **Date:** 2026-09-08
- **Decision:** Workspace `.content` has no top padding. `.stage-col` stays full remaining width and splits into pointer-inert `.stage-bg` for dial horizon/bloom and `.stage-scroll` (`overflow-y: auto`, `overflow-x: clip`) for content. The workspace page is full-width; the app-bar scroller is locked. Simple/palette editors fill the scrollport (`height: 100%`, wheel region `flex: 1`) and allocate leftover space above tiles to a wheel capped at 650px with a 400px floor; wide dial uses that floor, while narrow dial may shrink further. Simple/library editors have no stage wash. Themes use `#theme/<id>` and `_isDialView()` chrome, storing shared color and brightness at each solar event. Editing a scene's theme keeps that scene's light rings and list; standalone theme edit shows its single theme ring. Theme drags patch current lights/cards and graph handles immediately while preserving per-light overrides, without waiting for autosave.
- **Why:** Padding plus `overflow: visible` on the stage left a header gap and no middle-column scroll. Putting glow in the same box as `overflow-y: auto` clips bleed (CSS overflow axis quirk). A sibling background layer keeps graphics full-bleed while the list can scroll.
- **Do not reverse without user ask.**

## Desktop drawer overlays backgrounds; dial yields with one FLIP

- **Date:** 2026-09-08
- **Decision:** On desktop, keep the workspace and full-panel dial horizon at full width beneath the translucent, blurred drawer. Give only `.stage-col` a final right content gutter so the dial is centered in the unobscured view; animate the dial face from its old bounds to those final bounds with one FLIP translation+scale using the drawer’s curve. The landscape year rail collapses into that same FLIP. Do not animate shell padding, page width/margins, or background geometry. Simple-scene card backgrounds are circular light blooms painted with canvas radial gradients, not a barycentric mesh and not extra CSS gradient layers.
- **Why:** A fully overlaid drawer covered the dial; a shell gutter clipped the background and changed dial geometry before the drawer arrived. Separating foreground content from background reach lets the horizon remain visible under the drawer while the dial continuously moves and scales into the remaining view. The blooms stay on the one canvas the glow already blurs, so the list does not open a WebGL context per card or stack extra gradient elements.
- **Do not reverse without user ask.**

## Store owns light snapshots; variables and themes are house-wide (v6)

- **Date:** 2026-09-03
- **Decision:** The Scene Studio store owns editable scenes and light snapshots; native YAML is no longer the editable database or a five-scenes-per-room wizard. Color variables hold color and brightness; palettes reference five slots; circadian themes are shared house-wide. Swatches dim with brightness, and wheel presets use stored variables. Migrating existing rooms freezes their looks instead of guessing shared theme links. The Created-scenes tab and hide-managed-native-scenes setting are removed; leftover obsolete settings are dropped on load. Never override user entity-registry hides.
- **Why:** Generating five native HA scenes per room was MVP baggage. Area membership plus themes is how new lights pick up a look without re-editing every snapshot. Freeze migration keeps existing rooms pixel-identical instead of guessing theme links.
- **Do not reverse without user ask.**

## Live preview throttle while dragging the color wheel

- **Date:** 2026-09-02
- **Decision:** While dragging a wheel pin, live-preview `light.turn_on` calls are rate-limited to about once per 500 ms with a matching 500 ms transition. Click/preset/final release updates send immediately (no transition). Do not flood HA with per-pointermove service calls.
- **Why:** Instant click updates feel fine; unrestricted drag updates queue up and make lamps lag. Matching transition length keeps motion continuous between throttled samples.
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
- **Decision:** Serve `frontend/panel.js` from `/api/scene_studio/assets/<manifest version>-<PANEL_ASSET_REV>/panel.js` with `cache_headers=False`. Bump `manifest.json` `version` on release; increment `PANEL_ASSET_REV` in `panel.py` for in-progress frontend changes. After `docker compose restart`, pick it up on the **already-open** HA tab with a **normal** reload (`location.reload()` / user refresh / soft navigate that reloads the document) — not a new Cursor browser tab and not a hard-reload (`ignoreCache`). Soft in-app hash navigation alone often keeps the previously registered `scene-studio-panel` custom element. Before judging UI bugs, confirm the loaded asset revision and a changed DOM/CSS/behavior marker. Follow the shared browser verification skill; injected patches are previews until the final source is reloaded.
- **Why:** HA caches custom panel modules by URL. Python restarts do not pick up JS if the path is unchanged. Custom elements do not re-define when only the hash route changes, so agents can chase “fixed” layout bugs against a stale class. A hard-reload (or a new tab used as one) can reload the whole Cursor window.
- **Do not reverse without user ask.**

## Panel frontend as ES modules without a bundler

- **Date:** 2026-09-01
- **Decision:** Keep `SceneStudioPanel` in `frontend/panel.js` and split free helpers into sibling ES modules loaded with relative imports (`./color_ui.js`, `./dial_clock.js`, `./editor_session.js`, `./client_solar.js`). The static path registers the whole `frontend/` directory, so imports resolve next to `panel.js`. No bundler/build step.
- **Why:** `panel.js` was too large to navigate. HA already loads the panel as a module (`client_solar.js` proved relative imports work). Splitting by concern keeps behavior identical while making further extraction safer.
- **Do not reverse without user ask.**

## Use HA’s top app bar; header stays outside the scroll container

- **Date:** 2026-08-26
- **Decision:** The sidebar panel uses `ha-top-app-bar-fixed`. Title goes in `slot="title"`. Page content (sun path + form) goes in the default slot, which is the component’s scroll container. List view slots `ha-menu-button`; the editor slots a back button that hash-routes home (do not use `back-button` / `goBack()` — this panel is not HA history). Size the panel `:host` to `100vh` with `max-height: 100%`, and stretch the app bar to `100%` of that host. Do not size the app bar with `100%` of `ha-panel-custom` alone — that host often computes to 0 height, which collapses the bar and clips the page.
- **Why:** A custom sticky header had the wrong bottom-border token and sat inside our own overflow, so it did not pin. HA keeps the bar outside the scrolling region and uses `--app-header-border-bottom`. `ha-top-app-bar-fixed` itself uses `100vh` for the same 0-height parent. Pure `100vh` on the custom element is taller than the panel outlet in some shells (embedded browser / definite parent height), which adds a second scrollbar beside the app bar’s. Separately, CSS’s overflow quirk on the dial (`overflow-x: hidden` forces `overflow-y: auto`) stacked a second vertical bar on the editor.
- **Do not reverse without user ask.**
- **Constraint:** Empty-state height is relative to its scrollport; `overflow-x: clip` avoids CSS hidden/visible turning into a second vertical scroller. Workspace scrolling lives on the rail and stage, not the app-bar container.

## Standing on a solar event is 0% of the next transition

- **Date:** 2026-08-26
- **Decision:** Current event is the last whose start is *strictly after* now (`start > seconds`). Wrap-around remaining uses `seconds <= next_start` so an exact next-event time is 100%, not a leftover 86400s. Activation (`scene.py`) and preview share `current_sun_event_index` / `transition_progress_percent`. Out-of-range progress still raises; it is not clamped.
- **Why:** `start >= now` treated “exactly dawn” as still the dusk→dawn wrap. Remaining became 86400s, elapsed went negative, and preview samples on the 5-minute grid (dusk minimum 22:00, fallback dawn) raised “Extrapolation math error 2”.
- **Do not reverse without user ask.**

## Day transition percent is linear across the five scenes

- **Date:** 2026-08-26
- **Decision:** Replace `transition_modifier` (−100…100 clock shift toward noon/dawn/dusk) with `transition_percent` (0–100 along the day). Knots are equal 25% steps: dawn 0, sunrise 25, noon 50, sunset 75, dusk 100. Manual service values use that mapping directly (intra-segment blend is linear in percent, not in clock time). Auto follows the clock within each pair, then maps onto the same 0–100 scale. After dusk until the next dawn the attribute stays 100 (dusk is the last scene of the day); lights still interpolate dusk→dawn on the clock. A second attribute `transition_percent_manual` is true only when the last `scene_studio.turn_on` included `transition_percent`. Omitting the field (or using native `scene.turn_on`) returns to auto.
- **Why:** A relative time shift was not a readable “where in the day” control. Equal percent steps make 50% always noon regardless of season.
- **Do not reverse without user ask.**

## Scene editors use the automation sidebar / bottom sheet

- **Date:** 2026-08-26
- **Decision:** Light and theme-event controls open a right-hand outlined `ha-card` with `ha-dialog-header` on wide viewports (375px, 2px primary border), or `ha-bottom-sheet` when narrow or at most 870px wide/500px high. Use a 200ms ease-out slide; reduced motion uses 1ms. Pane changes reuse the drawer and fade its contents. Do not rely on automation-only sidebar components, which remain unregistered in a custom panel. Banners mount above `.stage-scroll` inside `.stage-col`, keeping the rail full height; narrow layouts park them on `.page`. Desktop background reach and foreground yielding follow the FLIP decision.
- **Why:** The chart should stay visible while tuning a lamp or assigning a scene, the same split as Settings → Automations. Custom panels cannot import the automation-only elements.
- **Do not reverse without user ask.**

## Legacy per-room entries migrate; this is not a breaking reconfigure

- **Date:** 2026-08-26
- **Decision:** Treat the sidebar/store move as a **minor** (2.2.x), not a major. On setup, each old config entry is imported into `scene_studio.scenes` using its `unique_id`, extra entries are removed, and scene entities keep that unique id. Users do not re-pick rooms or native scenes. The options flow is gone; editing happens in the sidebar. Mark 🚨 / major only if unique ids, service fields, or stored keys become incompatible without a migrator.
- **Why:** The configuration home moved; the data did not. A major would force a fake reconfigure on the only production user and on anyone who upgrades through HACS.
- **Do not reverse without user ask.**

## Native HA date field for the preview day

- **Date:** 2026-08-26
- **Decision:** The preview day control is HA’s `ha-selector` `{ date: {} }` (`ha-date-input` → `ha-dialog-date-picker`), presented as a day/month label. Do not use Activity’s `ha-date-range-picker` (that is a start–end range) or a raw `<input type="date">`.
- **Why:** Logbook’s widget is a range. The single-day native widget is `ha-date-input`. `ha-selector` already knows how to lazy-load that chunk from HA’s bundle; our `panel.js` cannot `import()` those files.
- **Do not reverse without user ask.**

## Year scrubber under the preview date

- **Date:** 2026-08-26
- **Decision:** Show a custom year timeline (month labels + draggable thumb) for the year of the selected preview day, with the selected day/month above it. Pointer drag/click maps to calendar days; keyboard arrows / Home / End work on the slider. Do not use `<input type="range">` — it cannot host month ticks. Keep the toolbar/scrub block as a stable sibling of the chart body so `replaceChildren` on preview redraw cannot drop pointer capture or focus. While dragging in dial view, update the thumb, day/month label, and dial from client sun math (no mid-drag websocket); on release, fetch HA preview once. Cache recent full payloads by chart key for idle redraws.
- **Constraint:** Wide landscape uses a right-hand year rail (104px plus stage padding); portrait uses the horizontal timeline. The rail yields through the drawer's single FLIP motion. Toolbar/readout nodes stay stable and do not use a negative left offset. Client sun math is scrub UX only; activation always uses HA solar math.
- **Why:** Jumping between solstices with chips is coarse; the calendar picker is precise but slow for seasonal comparison. A year strip is the missing middle. Re-inserting the scrubber on every preview cancelled the drag. A matching left gutter keeps the dial centered without overlaying the timeline on the face. Per-day HA preview mid-drag serialized updates to ~one frame per RTT; client geometry keeps the dial continuous through the year.
- **Do not reverse without user ask.**

## Preview location override is session-only and quiet until used

- **Date:** 2026-08-26
- **Decision:** Create/edit can override the coordinates used for the sun path and light graphs. Idle state is a map-marker icon in the editor header. Once a place other than Home Assistant’s configured lat/lng is applied, a warning-styled banner shows the coordinates, with Change and reset. The override is panel session state (not stored on the scene). Clock, “today”, and the now line stay on Home Assistant’s timezone — same as `scene_studio.turn_on`’s location field. Use HA’s `{ location: { radius: false } }` selector, with Photon search to move the pin; the map commits coordinates, not the search itself.
- **Why:** Polar / far-south sun times are the reason to preview another date; another latitude is the matching test. A always-visible map would crowd the date tools. Radius is unused for solar events. HA’s location selector has no search box of its own.
- **Do not reverse without user ask.**

## Earliest dusk is a house-wide setting

- **Date:** 2026-09-08
- **Decision:** `dusk_minimum_time_of_day` is an integration setting (seconds since midnight, default 22:00). Activation, preview, theme dial, and dial ghost/clamp visualization all use that one floor. Edit it in Settings and as the **last item in the scrollable body** of the light / theme-event sidebar while dusk is the open event (hidden for other events; not in the sticky action footer). Per-scene `scene_dusk_minimum_time_of_day` is lifted into settings on load and dropped. Solar-event buttons open the theme-event sidebar (color, brightness, variables) for the scene’s theme or the theme being edited; a banner names the theme and warns that edits apply to every circadian scene still using it. Per-light overrides stay. Ring clicks still open per-light edit on a scene, and the same theme-event sidebar on a theme.
- **Constraint:** True solar dusk remains on path dots/night wedges. Only the interactive event button moves to the house-wide floor, with a disabled solar ghost and dashed link. Preview exposes `solar_seconds` for overridden events. Same-day dusk may be delayed; next-morning dusk retains its wall-clock time and solar order.
- **Why:** The floor is about when dusk is allowed to happen in the house, not a property of one room scene. Event buttons are the place to inspect that solar event; Settings is the house-wide copy of the same control.
- **Do not reverse without user ask.**

## Editor undo/redo matches the automation editor

- **Date:** 2026-08-29
- **Decision:** Scene and library edits autosave after about 250ms; there is no Save FAB or Save/Discard session buffer. One global undo stack (75 entries) includes before/after snapshots, target view, sidebar focus, and variable/palette drafts. Commit the previous snapshot before each discrete edit; a drag/scroll is one entry. Undo/redo opens the owning scene, variable, palette, or theme and restores its sidebar. Stacks survive navigation and are available on the list. Ctrl/Cmd+Z, Shift+Z, and Y skip text/select/contenteditable controls. Creation has its own delete/recreate undo record.
- **Why:** Immediate save keeps cards and other scenes in sync while you edit. Global undo is the replacement for a Save/Discard buffer.
- **Do not reverse without user ask.**

## Autosave replaces the local draft buffer

- **Date:** 2026-08-29
- **Decision:** Edits autosave and hide/leave flushes `_saveNow`. There is no localStorage session buffer or restore banner. Clear legacy draft keys on save/delete. Global undo replaces the former unsaved-session workflow.
- **Why:** Autosave and global undo replaced the browser buffer. Old `localStorage` draft keys are cleared on save/delete if they still exist.
- **Do not reverse without user ask.**

## Circadian dial geometry and interaction

- **Date:** 2026-08-29
- **Decision:** Circadian editing uses only the 24-hour dial: midnight at the bottom, noon at the top, one ring per available light, full to the center. Rings blend softly at rest and sharpen on hover/selection. A selected ring yields to a hovered ring so only one is highlighted; siblings dim to 50%, and clicking the selected ring or outside light/editor chrome clears it. Ring clicks and circadian tiles open the closest-event light sidebar. Hourly ticks use theme text/surface colors. The perfect-circle sun path scales with seasonal peak versus annual maximum; day is solid, night dashed, both non-scaling strokes. The sun is outlined, with day-clipped fill/glow and SVG radial softness (no moving CSS blur trails); night is outline/shadow only. Size grows toward sunrise/sunset and stays doubled overnight. Free scrub snaps only on release near a solar event, then stays sticky until reset/event selection/leave; date/location changes retain it. The selected event pins the sun; idle follows now on the preview date. The override arc preserves clockwise/counterclockwise direction. The horizon spectrum lerps continuously by elevation; at civil dusk (-6°) it becomes dark blue without pink/purple afterglow. Warm gray night wedges suit light theme, near-black suits dark. Static bloom/horizon layers are isolated from moving sun work. Sun/handle hits sit below rings and the handle is tip-only. The face uses `touch-action: none`; cancel touch movement only while cancelable. The old table toggle and saved view preference are gone.
- **Why:** A ring makes the dusk→dawn wrap obvious. Equal clock hours match how people read “now”; solar events still land at their real times. Seasonal circle size shows how high the sun climbs without wobbling the path; elev still drives size and day/night clip. Snap-on-release keeps dragging predictable; a wider soft vignette keeps chrome readable over horizon bleed without a hard cut. Light-theme gray night wedges read as shadow without a muddy disc; dark theme keeps near-black so night is not washed out. A stretched multi-color rim that ends at the surface reads more like a real sunset than a single tint faded to transparent. Without blur, a filled glow under opaque rings vanishes — the halo must live outside the planet rim. Light-band bloom sits above the isolated horizon wash so dial colors read over the rim, not under it. Two staged per-clone blurs keep lg/md blooms distinct; compositor promotion + planet `box-shadow` still isolate static dial work from scrub. A 26px day/month in an 88px rail overflowed the stage and created a horizontal scrollbar — pad and size the rail instead of clipping the page.
- **Do not reverse without user ask.**

## Smooth cross-mode color blends

- **Date:** 2026-08-30
- **Decision:** Chromatic HS/RGB pairs interpolate hue and saturation without wrapping hue, including mixed HS↔RGB and RGB↔RGB; wheel path and runtime agree. Prefer `hs_color` when a draft also has `rgb_color`. Temperature↔color and rgbw/rgbww pairs convert endpoints to RGB and channel-lerp while preserving white-channel behavior. Same-mode kelvin/channel pairs keep their lerp. Never switch extrapolators at 50%.
- **Why:** The old halfway mode switch snapped white↔color (and wheel polylines) whenever day scenes were color_temp and evening scenes were HS/RGB. RGB-channel lerp of saturated complements also drew a path through white, which contradicted “through the color wheel” for chromatic pairs.
- **Do not reverse without user ask.**

## Dial light list stays under the face

- **Date:** 2026-08-30
- **Decision:** The light-tile strip stays under the dial in the editor column, never in a landscape side gutter. The face fits the space remaining above the full tile strip, not a 32px peek. Wide dial keeps a 400px floor; narrow dial may shrink below it so phone content does not scroll. Banners count against the face budget.
- **Why:** Parking the list in the left gutter left-aligned/truncated names and broke parity with portrait. Under-face flow matches mobile. Fitting the full strip keeps membership and brightness controls visible without a discovery-only peek.
- **Do not reverse without user ask.**

## Editor overflow matches the native scene page

- **Date:** 2026-08-26
- **Decision:** Create and edit both show the native scene overflow (`ha-dropdown` + dots). Shared actions are Information, Settings, Assign/Edit category, Rename, Duplicate, and Delete. Card menus also offer Activate; editor overflow offers location preview and narrow-only Live edit/play actions. Create persists the entity immediately; supporting actions use that saved entity. Skip Edit YAML — this panel has no YAML mode. Category opens the rename/settings dialog with the category field visible so the store and registry stay in sync. Delete uses an `ha-dialog` with the native confirm strings, not `window.confirm`.
- **Constraint:** Card taps select/deselect rather than activating; do not stop propagation on the dropdown dots. Circadian covers are per-light dawn→dusk ramps scaled by brightness, feathered over the incoming top third; simple covers use canvas light blooms. List mutations patch items immediately, and generation guards prevent older list/preview replies from repainting a newer route. Hash writes already at the target still call route synchronization.
- **Why:** Users already know that menu from Settings → Scenes. A shorter custom menu hid Apply / info / duplicate.
- **Do not reverse without user ask.**

## Panel copy uses HA backend translations (en/nb/nn/de/es)

- **Date:** 2026-08-30
- **Decision:** User-visible panel strings live under `translations/<lang>.json` → `frontend.*` (plus existing `config.*`). The panel loads them with `hass.loadBackendTranslation("frontend"|"config", DOMAIN)` and resolves via `_t("frontend…", englishFallback)`. English is the source of truth while working on `dev`; the other four languages are filled before a release PR. See `.agents/skills/panel-translations/SKILL.md` and `.agents/skills/prepare-release-pr/SKILL.md`.
- **Why:** Custom integrations cannot use Lokalise/`strings.json`; shipping full language files matches HA’s custom-integration i18n path and the user’s language set. Translating on every UI tweak duplicated work; one pass against the English diff is cheaper and still ships complete trees.
- **Do not reverse without user ask.**

## List tabs use ha-tab-group

- **Date:** 2026-08-30
- **Decision:** Scene list tabs are native `ha-tab-group` / `ha-tab-group-tab` (`tabOnly`, `wa-tab-show`), not custom buttons.
- **Why:** Matches HA chrome (automation traces, etc.) and stays consistent when the design system moves.
- **Do not reverse without user ask.**

## List view does not re-render on every hass assignment

- **Date:** 2026-09-01
- **Decision:** The panel `hass` setter updates child `.hass` refs and loads translations once. It does not call `_renderList` on later hass ticks. Rebuild the list from `_loadList` / tab changes / explicit actions.
- **Why:** HA assigns `hass` on every state update. Rebuilding the list tore down controls (visible flicker) and closed the settings sidebar via `_closeSceneSidebar()`.
- **Do not reverse without user ask.**

## Unavailable lights stay in the list, not on the dial

- **Date:** 2026-09-01
- **Decision:** Clock rings omit unavailable (or missing) lights. The light-tile strip retains them after available members and before removed/suggested lights, marked unavailable. Known-capability unavailable lights remain editable; unknown capabilities are grayscale and inert. Live `hass.states` is the source of truth.
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
- **Why:** Instant date jumps and the coarse→Astral ring swap read as flicker. A longer ease-out is the requested motion. Knot CSS ramps ≠ dense sample conics; destroying/recreating night wedges every frame flashed the bottom of the dial; updating two 0.815-opacity bloom clones every frame made mid-morph colors look stronger until settle.
- **Do not reverse without user ask.**
- **Constraint:** Refine coarse event knots to a five-minute grid before the Astral settle morph. During morph, update wedge paths in place and defer bloom/rim repaint until the end to avoid doubled chroma and flashing layers.

## Sandbox scenes.yaml is runtime, not source

- **Date:** 2026-09-01
- **Decision:** Gitignore `dev/config/scenes.yaml`. Do not commit the live file or a starter example — native scenes are sandbox-local and do not translate to other setups. First-time setup creates an empty list (`[]`) if the file is missing. Do not bind-mount a second scenes file into the container — `dev/config` is already `/config`.
- **Why:** The scene editor and this integration write HA’s native YAML back to `/config/scenes.yaml`. Tracking that file made every sandbox tweak a dirty tree and clobbered local scenes on branch switch.
- **Do not reverse without user ask.**

## CI lint uses current Home Assistant Requires-Python

- **Date:** 2026-08-30
- **Decision:** GitHub Actions lint/tests use Python **3.14** and install the latest PyPI `homeassistant`.
- **Why:** Unpinned `pip install homeassistant` on 3.11 resolves to ~2024.3, which lacks `StaticPathConfig` / `LockState` and breaks pytest collection via `panel.py`. Current HA requires Python ≥3.14.2; matching that keeps lint and unit tests on the same API surface as the sandbox.
- **Do not reverse without user ask.**
- **Constraint:** Keep `StaticPathConfig` a normal top-level import with the supported HA version; lazy import triggers lint.

## Work on `dev`; a PR to `master` is a release

- **Date:** 2026-09-01
- **Decision:** Day-to-day work (and feature-branch PRs) target `dev`. Opening a PR to `master` is how a version ships: the prepare-release-pr skill syncs translations and Unreleased, then merge runs `.github/workflows/release.yml` (version bump, changelog move, GitHub release, merge back to `dev`). Do not bump `manifest.json` or move Unreleased in that PR. Do not maintain nb/nn/de/es or Unreleased during feature work on `dev`. `release:skip` (or empty Unreleased) lands on `master` without publishing.
- **Why:** Cutting the release in the agent duplicated (and fought) the GitHub workflows. Translating and changelog-editing on every change set was slower than one pass against the `master` diff. `master` stays the HACS/GitHub default so visitors see released code.
- **Do not reverse without user ask.**

## Continuous follow-up is built into the integration

- **Date:** 2026-09-01
- **Decision:** Circadian scenes reapply at the global `automatically_update_lights_interval` (default 300s; 0 disables updates). Ticks use that interval as transition and target now + transition; first activation keeps the caller's transition and waits one interval. Stop when another area scene is last activated or modifiers are set. Skip manual overrides; treat drift/unresponsive lights within tolerance or still moving toward the command as retryable. Non-user off/unavailable interrupts leave the light dark; on return, reapply its target once. Available off-path jumps and HA UI user changes remain overrides. Do not stop just because all lights are off, and do not implement this as a blueprint. Public keys are `automatically_update_lights` with `_active`/`_interval`, not continuous/follow_up. Per-scene play/stop and enable flags are obsolete; the global preference controls updates.
- **Why:** The user’s continuously-activate blueprint was a roundabout loop and blocked override/drift features. Built-in automatic updates match the product and keep override state on the scene entity. Power-cut restore must reclaim the lamp; a reading-light dim must not. “Update lights” names what changes; “update scene” would sound like editing the scene definition.
- **Do not reverse without user ask.**

## Prefer readable public keys for automatic light updates

- **Date:** 2026-09-01
- **Decision:** Use long store/entity/WS names `automatically_update_lights` (+ `_active`, `_interval`) rather than short jargon (`continuous`, `follow_up`). Length is acceptable when it removes ambiguity.
- **Why:** Users inspect attributes and settings; clarity beats HA-style brevity here.
- **Do not reverse without user ask.**

## Live edit applies the scene at the selected clock; play walks 24 hours

- **Date:** 2026-09-09
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
- **Decision:** Stored color variables (`kind: color`) and palettes (`kind: palette`, always five slots) remain separate kinds, exposed as color presets and scene presets in Library alongside circadian presets. Dedicated routes do not convert one kind into another. Slots hold static color/brightness or a color-only `variable_ref`; nested palettes are invalid. Palette application stores its id and an application-site `assignment_seed`; FNV-1a hash(seed, entity_id) % 5 assigns stable slots. Randomize changes the seed and clears pinned `palette_t`/`palette_r`. Wheel dragging stores polar coordinates (white center to rim) while retaining the palette link. Event/light brightness may differ from sampled slot brightness. Mode controls and preset eligibility follow the current palette-mode and uses-menu decisions.
- **Why:** Multi-light scenes need several related hues from one named token without each lamp sharing one solid. Hash+seed is stable; the polar wheel is how the user pins a blend between those five rim colors.
- **Do not reverse without user ask.**

## Color/kelvin mode selector matches huemane-light-card

- **Date:** 2026-09-16
- **Decision:** The wheel mode control is the Hue/huemane pill: 48px capsule (`8px` padding, `8px` gap, `0px 2px 3px` shadow, `--surface-2` / `#242022`), 32px wrappers with 24px faces, 2px white ring when active. Color and kelvin faces use the PNGs from `etokheim/huemane-light-card`. It sits in `.hue-wheel-chrome` **bottom-left**; color-variable swatches stay **bottom-right**. Do not overlay a larger custom pill on the disk.
- **Why:** That control is already the house language for switching wheels; a top-centered 36px version read as a different widget.
- **Do not reverse without user ask.**

## Main column is the editor

- **Date:** 2026-09-16
- **Decision:** `.stage-col` edits scenes, color presets, scene presets, and circadian presets on `#edit`, `#variable`, `#palette`, and `#theme` routes. The rail is a picker. Creation dialogs may choose starter or existing presets before creating the item and opening its stage editor; actual library content editing is not a modal. Rename/settings/confirmation dialogs and light sidebars remain supporting surfaces.
- **Why:** Dialogs hid the workspace and split create vs edit. One column keeps the same place for every kind of edit.
- **Do not reverse without user ask.**

## Simple-scene lights are huemane light tiles

- **Date:** 2026-09-16
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
- **Decision:** When a rail actually remounts, restore its `scrollTop` after workspace height is applied and ignore scroll events during restoration. Stage scrolling resets for a new editor. Wide scene/list transitions and same-library selection preserve the existing rail, as specified in their navigation decisions; do not rebuild it just to update selection.
- **Why:** Recreating the rail DOM was jumping the picker; the editor column is a new document. Restoring immediately after `replaceChildren` ran before workspace height settled, so the browser clamped `scrollTop` and the scroll listener saved the clamped value.
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
- **Decision:** Create scene / variable / palette / theme stores **Untitled** (translated). Editors have no Name field. While the open item is still a placeholder name, a corner FAB (**Name scene/palette/variable/theme**) opens the rename dialog, prefilled with the theme name for circadian scenes and the palette name for simple scenes (Variable / Palette / Theme otherwise). Do not prefix those suggestions or auto-configured scene names with the area — the list already groups by area, and displayed light and scene names strip a leading area prefix. Unnamed scene cards also show a rename control left of the overflow menu.
- **Why:** Forcing a name at create blocked getting to the editor. The FAB is the prompt once you can see what you made.
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
- **Decision:** The simple-scene color wheel does **not** draw the circadian travel/preview path (simple scenes do not interpolate). Pins within 10% of the wheel radius and the same mode merge like `huemane-light-card` (`tryMergeMarkers`); the stack shows a count and moves together. A light-tile click selects only that light and pulls its pin out of the stack. Clicking the stack (without dragging) fans the pins. The color/kelvin pill converts every selected draft that supports the mode and glides those pins; the rest stay and leave the selection. A single selected pin shows the light’s `mdi` icon (simple) or the solar-event icon (circadian); a stack still shows the count. **Select all** selects every member; a drag writes every selected draft that supports the disk under the pointer. Circadian wheels keep the solar-event path and ungrouped per-event pins. Membership add/remove controls (action plates and leftover add-back tiles) are the same in both editors. Re-adding a removed light must not change strip scroll or the current selection. The simple-scene disk is the leftover height in the stage scrollport above the light-tile strip (mode row included), down to 400px, then the stage scrolls.
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
- **Decision:** In the simple-scene editor, light tiles are grouped by the color mode they are in now (color, temperature, white, brightness). The group label is vertical; hovering it reveals “Select all”, and clicking it selects that group. The circadian dial strip uses the same groups, from the light’s current event color. Cmd/Ctrl-click toggles one tile, Shift-click selects a range, and Cmd/Ctrl+A selects every member in the simple editor. Arrow keys move that selection; Shift+arrow extends it. A plain click selects only that light and peels its pin. The settings action on the upper tile plate opens the light’s settings dialog; a plain tile click does not. The long-press mode picker is gone. While a pin drag is moving, a visible color or kelvin disk fades out when none of the dragged lights support that disk. The area-rail card mesh repaints from the live drafts while the wheel or brightness changes. Each dot is `scaledCardRgb`: chromatic RGB times brightness/255; off or brightness at or below 0 is black. Each area’s plus (and empty-area) button is an `ha-dropdown` with “Create circadian scene” and “Create scene”. User-facing copy says “Scene”; the stored kind stays `simple`. Rename (editor and card) does not offer an area picker — the scene stays on its area. It does offer Icon (always visible), plus Category and Labels as chips until filled, matching native scene rename. The icon is stored on the scene and written to the entity registry. The Home Assistant sidebar icon for this panel is `mdi:palette`.
- **Why:** Multiselect and mode groups are how a room of mixed bulbs is edited. The long-press picker duplicated the wheel. The card has to follow the drag, not the save. “Simple” is not a useful distinction in the UI. Area is chosen by where the scene was created; icon, category, and labels are the native rename fields.
- **Do not reverse without user ask.**

## Light strip motion, mode pill, and one legend

- **Date:** 2026-09-22
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
- **Decision:** Dropping a temperature pin on the left of the kelvin ring leaves it on the left. That side is remembered only on the live wheel; a refresh places every temperature pin on the right again, and the side is not written into the draft. Color and temperature groups use the same surface, shadow, and padding as the mode pill. On/off members resist and snap at halfway (huemane: resistance 0.56, jelly). A light that cannot do color or kelvin is grouped as brightness even when its stored draft is still `color_temp`. Every light tile, including Select all, shows its brightness percent on a second line.
- **Why:** The centerline math always used the positive x, so a left drop jumped right. Persisting the side would make refresh disagree with the default distribution. Soverom garderobe is brightness-only hardware with a stale kelvin draft, so capability has to win over the stored mode.
- **Do not reverse without user ask.**

## Empty disk click, group label, and drag readout

- **Date:** 2026-09-22
- **Decision:** In the scene editor, a click on the color or kelvin disk that is not on a pin clears the selection. It does not move the selected light. Variable, palette, and light-sidebar wheels still place color from an empty-disk click. Select all and Add light sit on the same baseline as tiles inside a group. The HS/kelvin readout while dragging is anchored above the pin body, not on the tip. Group labels use the current centered name and bottom icon layout.
- **Why:** Clicking the disk was a second way to throw the selected bulb to the cursor. The readout was drawn from the pin tip, so it covered the pin.
- **Do not reverse without user ask.**

## On/off tiles, native switch, and group labels

- **Date:** 2026-09-22
- **Decision:** On/off light tiles say On or Off. Select all still shows the average percent. The on/off stand-in is `ha-control-switch` with the `vertical` and `reversed` attributes set (the properties do not reflect, and the component’s layout is attribute CSS). Brightness and on/off stand-ins sit on the same blurred glow as the color wheel. The group label’s name is centered; the select-all icon is pinned to the bottom of the group (see “Wheel aside follows the light-list gutter”). Both share the label color, including hover. An invisible inset on the label enlarges the touch target. Selecting a pin or clicking the empty disk updates selection in place; the strip rebuilds only when a light changes group. Select all is painted at its average fill the first time, so a rebuild does not animate up from empty.
- **Why:** Forcing a horizontal switch to 130×320 drew the thumb as a full-height column on the right. Rebuilding the strip on every disk click replayed the Select all fill transition.
- **Do not reverse without user ask.**

## Wheel aside follows the light-list gutter

- **Date:** 2026-09-25
- **Decision:** The disks stay centered in the editor column, and the light list stays under them. The color modes and variables stack in a column centered on the disk while they fit 48–80px past the disk’s edge (80px when the gutter allows, closing toward 48px, then the horizontal row). Labels sit to the right of each dot. The color modes stick to the top of that column, with a gap and a rule above the variables. A selected dot keeps the same 2px gap before its white ring as the horizontal row. A click on a variable applies it to the selected lights and does not clear that selection. A click on a pin only selects it; the color changes after the pointer moves past the drag threshold. A collapsed group dot grows from the single-dot size toward 32px across as the group goes from two lights to four or more. The hit target stays 40px.
- **Why:** The aspect-ratio switch put the names in the corner of the wheel box, and a click was already writing a color.
- **Do not reverse without user ask.**

## Select all is relative

- **Date:** 2026-09-23
- **Decision:** Dragging or scrolling the Select all tile scales each dimmable light by the next shown average divided by the average at the start of the gesture. One light at 100% and one at 50% show 75%; taking that to 37.5% makes them 50% and 25%. A light already at 0% stays at 0%. A light stops at 100% if the scale would pass it. If the starting average is 0%, every dimmable light takes the new level so the gesture can turn them on. On/off-only lights do not change that average; they follow it, on at or above 50% and off below. With one or no lights selected it covers every member. Select mode (two or more lights, or a long-press on touch) covers only the selection, uses the average fill and offset selection ring, and shows the selection count with Deselect on both label layers. A tap selects every member, unless select mode already has two or more, in which case it clears them. In select mode a tile tap toggles that light; otherwise a tap selects only that light. Each group title sticks 8px from the left of the strip while that group is on screen. Until it sticks, it has no ramp, so the first tile stays clear. Once it sticks, tiles that slide under it fade through a ramp in the group’s own fill. The ramp stays inside the group border, on the padding edge, and its left corner matches that inner radius, staying on the group’s corner while the title is stuck. The corner becomes 0 once the title has been stuck by that radius, because the curve has slid away and the visible edge is straight. The ramp also stops before the group’s right border. A wide wheel with enough gutter keeps the mode and variable column absolutely on the right so the disk stays centered. The selected row’s ring wraps only the color, its label is bold, and unselected rows are at 75% opacity.
- **Why:** Writing the finger position onto every draft made a dim lamp jump to match a bright one. The count is how you see which lights the gesture will move.
- **Do not reverse without user ask.**

## Light strip chrome

- **Date:** 2026-09-23
- **Decision:** Removed lights sit in a Removed group and show no brightness. Unavailable lights sit in an Unavailable group. The tile face and those groups use the same glass stroke as the rest of the panel. The brightness and on/off stand-in glows a blurred copy of the filled part of that control, and it does not show a relative time. Dragging a tile’s brightness, or snapping an on/off tile, updates that stand-in the same way the slider updates the tile. The power button under the slider is round. A one-line hint under the tiles explains the drag. On a circadian scene that hint asks for a solar event or a light until an event is selected.
- **Why:** A removed row was still reading as a dim light, and the level glow did not follow the control it sat behind.
- **Do not reverse without user ask.**

## Tile actions and light-mode depth

- **Date:** 2026-09-23
- **Decision:** Settings/remove share the upper action plate and power the lower plate. Plates use group fill, square inner edges, transform-only motion, and sit behind the tile/shadow/selection ring. Timing and single-open-menu behavior follow “Tile action buttons” (500ms). The tile ring scales with its frame. Negative-margin scrollport padding lets plates overlap wheel/hint without growing the strip. Flying tiles are reparented onto the strip so backdrop filters do not trap them. The wheel blits its cached bitmap immediately to avoid an empty-canvas undo flash. Clicks outside tiles/groups/wheel controls/stand-ins clear selection; an empty scene-wheel face clears too. Light mode adds soft shadows over glows; Select all uses the shared offset selection ring. Scene icons center across title/kind, and narrow/portrait strips reach page edges.
- **Why:** Hover-only corner discs were unreachable on touch, and a group’s backdrop-filter trapped the move animation. Decoding the wheel image on the next frame painted black first.
- **Do not reverse without user ask.**

## Pin expand, group flight, and shadow

- **Date:** 2026-09-23
- **Decision:** A pin’s teardrop grows and shrinks with the CSS `scale` property, both ways, including group pins and drop targets. Reparenting a pin restarts that transition, so a drop target is appended only on the frame it becomes a target, and a group lead already in the wheel is left where it is. Opening a group shows each member’s icon and flies the pins out from the stack. Leaving the group, or grabbing one member, flies the others back to that stack with their icons still showing. The active pin’s heavy shadow hangs downward (`feOffset dy` negative; the pin body is rotated 180°).
- **Why:** Animating `transform: rotate() scale()` on the SVG did not reverse, and appending the node on every move cancelled the transition before it could be seen. The return flight had no stored home, so leaving the group hid the members in place.
- **Do not reverse without user ask.**

## Picture palette catalog

- **Date:** 2026-09-25
- **Decision:** The gallery is Daylight, Cozy, Evening, Night, Party, Romantic, Sunrise, and Neon, including Desert sunrise. Wood lamp keeps builtin id `wool` and City rain keeps `rain`, because those photos are the same files. Every other previous picture id is unused, including `blue-hour` (Harbor). The Lofoten picture is `blue-hour-reine`. A palette already copied from a removed picture keeps its colors; its photo and per-slot reset stop resolving.
- **Why:** The pictures and the light colors were chosen together. Reusing an old id for a different photo would change reset on palettes people already saved.
- **Do not reverse without user ask.**

## Picture palettes

- **Date:** 2026-09-23
- **Decision:** The new-scene chooser lists user palettes before starter picture sections from the current catalog. Choosing a picture adopts a library copy with `builtin_id` and points the scene at it. Its five colors are room-light colors chosen with the photo, not sampled pixels. Per-slot restore returns to that starter's value. Slot groups and relative Select all share the light-strip behavior. A copied preset leaves the starter list once a library item has its `builtin_id`. Photo credits live in `frontend/gallery/CREDITS.md`; the editor shows its source and uses controls.
- **Why:** A built-in has to stay available to reset against, and each use has to be its own palette so one scene’s edits do not rewrite another. The photographs are credited in `frontend/gallery/CREDITS.md`; the section and palette names are not taken from another app. Source and uses controls link back to the copied preset and to scenes that use it.
- **Do not reverse without user ask.**

## On/off group and palette base

- **Date:** 2026-09-23
- **Decision:** On/off-only lights sit in their own strip group. A new scene asks for a palette base or a custom start. Choosing a palette stores that id and a seed on the scene, and each area light keeps only the palette reference so color and brightness stay inherited. Choosing custom stores each area light’s current state. If a palette was previewed in the dialog, that preview is restored first and the scene keeps the room from before the preview. Editing a light drops the reference and keeps the current values; the remove button becomes reset, which links that light again. The same palette chip as the library list is used in the dialog. Live edit in the dialog previews the palette on the area’s lights, and randomize beside the selected palette changes the seed.
- **Why:** On/off bulbs were sitting in Brightness. A palette base has to stay linked until the user changes a light, or reset has nothing to return to.
- **Do not reverse without user ask.**

## Tile action buttons

- **Date:** 2026-09-23
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
- **Decision:** Hovering a disk dot opens that pin and leaves the selected pins open. Moving away closes only the hover pin. The hover does not change the selection. A plain press selects that light and closes the others. Cmd, Ctrl, and Shift each toggle that disk light. Shift range select stays on the tile list. A resting marker is the earlier round dot: 12px fill, 2px white ring, shadow, and nothing drawn inside it. Selecting, hovering, or grabbing it grows the teardrop pin around the same tip, and that change animates open and closed. Hovering a stack grows that one pin and shows how many lights it holds; leaving collapses it again. Dragging the stack selects those lights and keeps that pin open with the count. A pin close enough that a drop would join it grows the same way until the pointer moves off. A click on a stacked pin opens the group as pins that start on that pin and travel onto a center circle. Grabbing one of those pins closes the group, keeps that pin out of the stack until the pointer is released, and moves only that light. Mode changes, undo, redo, and other moves glide; a drag follows the pointer.
- **Why:** Opening the hovered pin used to move the hit target off the cursor, so the pin keeps a tip hit under the pointer. The old drop animation snapped the scale to 0.7 before growing back, and a separate dot path jumped instead of springing. Shift range select on a disk did not match Cmd.
- **Do not reverse without user ask.**
