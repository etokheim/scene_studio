# Scene Studio editor guide

## Scenes and shared presets

Scenes belong to Home Assistant areas. Ordinary scenes keep a fixed look; circadian scenes blend dawn, sunrise, noon, sunset, and dusk. Auto configure creates circadian scenes for areas. On mobile, Manual configuration opens the empty area list for the current visit; the Auto configure card appears with that list, not with the welcome placeholder. Desktop and Library retain Live edit.

Library color presets, scene presets, and circadian presets are shared. Editing one changes its dependents. Editing a scene or its solar event changes only that scene. Saved edits autosave; undo/redo tracks your own work. Live edit defaults to on, and Delete and reset everything restores that preference in the browser performing Reset.

Admin editors receive saved changes from other admins. Different fields merge; conflicting changes to the same field pause that item's autosave and offer local or newly saved values. Color values and membership arrays remain indivisible. A remotely deleted item retains its open draft for copying and is never recreated automatically. Older clients must reload before saving without a revision.

## Solar-event editing

Select an event before selecting or changing lights. Tiles, dial bands, and disk markers share selection. The event sidebar shows all member lights: selected lights are pins, others are selectable dots. Use grouping, color-mode movement, multiselect, or Select all as in the ordinary editor. Select all is first, counts every member including unavailable lights, and uses the same gray default everywhere. On/off lights use binary controls.

Closing the sidebar retains the selected event and lights; selecting a light reopens it. Switching events retains member light selection. Clicking the selected event or moving preview time deselects the event. Leaving the scene clears both selections. Blocked event edits show a three-second reminder over the scrollable strip; real dial event buttons remain clickable and pulse once unless reduced motion is enabled.

Field resolution is: explicit light/event override, event scene preset, inherited circadian preset, then light capability adaptation. Assigning a preset creates no light overrides merely because lights are selected. Manual edits override only their edited fields; color is one value. Temperature-only and brightness/on-off previews follow their capabilities.

The event graph adjusts inherited brightness proportionally without changing explicit brightness overrides or the shared preset. Each gesture uses a fixed baseline; zero brightness and saturation are supported. Replacing the event preset resets its adjustment. Randomize changes inherited assignments at this event, keeps manual overrides and other events, and saves its seed. The event disk immediately shows only the selected event's preset and assignments.

Reset at the event source removes its scene-specific assignment, adjustment, and seed, preserving individual overrides. **Light overrides** compares each light with the current event configuration, including its brightness adjustment and capability adaptation. Individual Reset overrides clears that light at this event. Reset all clears only individual-light overrides at this event in one undoable save; it preserves the event source, adjustment, randomization, and other events. Saved effects still apply and appear in the override list; the editor has no effect picker.

## Activation and update controls

Scene entities retain HA's activation-timestamp state and expose `active`, `automatic_updates_paused`, and `automatically_update_lights_active`. Activation replaces the current Scene Studio owner in the same area. Across areas, overlapping lights transfer to the new scene while older owners keep their other lights. Paused scenes can remain active. All respected manual overrides can make a scene inactive; temporary unavailability does not count as a manual change.

The global **Scene Studio automatic updates** switch mirrors Settings. Per-scene preferences use `scene_studio.set_automatic_updates` with circadian Scene Studio `entity_id` targets and an `enabled` boolean. Pausing persists until explicitly resumed; activation while paused applies the look once. Resuming eligible owners moves toward the current target with the interval as transition duration, without reclaiming lost ownership. Restart restores preferences but requires activation before automatic commands.

**Respect manual changes** defaults on. **Always follow scene** makes listed lights follow even after manual brightness, color, or off changes. **Always respect manual changes** respects listed lights even when the global policy is off. These lists are mutually exclusive. Scene Studio commands, transition reports, and unavailability are not manual overrides.

**Latest dawn** defaults to 06:00 and advances later solar/fallback dawn. **Earliest dusk** preserves the saved limit and delays earlier dusk. Each has an enable switch; disabling restores solar/fallback timing. No other event limits are configured.

Deleted HA areas remain listed with a struck-through retained name and Deleted label. Their scenes do not activate or update automatically. Move transfers all scenes to a current area and its light membership, retaining looks and applicable overrides. Delete confirms the count and removes those scenes, their entities, and the retained area name; shared presets remain.

## Layout, cards, and navigation

The shared CSS Grid shell has a full-width toolbar, flexible preview with timeline, and full-width bottom light/slot section. Preview floors are 300px, capped by available editor width and usable window height; short stages may scroll. Dial previews cap at 900px, ordinary disks retain their size limit, and both have 24px vertical gaps. At editor widths of at least 1100px, previews extend behind clickable toolbar controls. Play scene live is hidden on mobile. There is no toolbar shadow ramp; Now and sun-angle labels always occupy a separate row below the controls. Preset controls remain in the shared toolbar when overrides refresh.

Timeline orientation follows editor-container dimensions: vertical in landscape, horizontal in portrait. Its track stays within the preview region. Sidebars overlay the toolbar, preview, and lights below the app header without resizing the preview. Only naturally overflowing light strips gain trailing room so their last tile can clear the sidebar; short strips keep their position.

Same-type dial/disk morphs remain. Incompatible editors crossfade only the preview: outgoing scale 1→1.08, incoming 0.92→1, with existing easing, 280ms opacity and 400ms scale. Outgoing nodes and geometry survive until completion. Toolbar/light hosts remain mounted with destination-owned handlers. Reduced motion omits scaling. Horizons belong only to mounted circadian editors and temporary outgoing layers.

Scene palettes appear below titles. Cards scale on selection, not hover; touch hold opens their menu. Circadian thumbnails blend the whole day's event images, using scene event assignments before inherited presets and color fallbacks when needed. Ordinary card meshes repaint immediately when their preset changes. Used in menus show scene name and area. Empty area counters are hidden.

Color presets occupy four responsive columns with two reserved name lines and full-name tooltips. Selected pills push neighbors aside without wrapping the fourth item. Clicking an already selected Library preset, or Enter/Space, returns to the Library overview without changing assignments.

Public routes are `/scene_studio/scenes`, `/scene_studio/scenes/ID`, `/scene_studio/library`, and `/scene_studio/library/{color-presets,scene-presets,circadian-presets}/ID`. Legacy hash links normalize to these paths. Explicit overview routes and the remembered tab preserve Back, refresh, and mobile return navigation.

Both creation preset pickers put their subtitle in the scrolling body. Start from scratch is the sole primary action until a preset is selected, when it becomes secondary without changing its label. They choose starters; actual editing remains in the stage.

## Privacy and local preview

The editor/store WebSocket paths require an admin; generated scene activation and entity controls use HA permissions. Shipped static resources are distinct from store data. Activation and solar calculations are local.

The optional alternative-location dialog keeps HA's map. Search/Enter sends the typed query and browser IP to Photon (Komoot), as disclosed below the native HA search field. Opening the map may request external map tiles. Configured HA coordinates or manually entered coordinates also work. Browser UI preferences are not credentials; they do not become editor payloads. Default logs must not dump entity payloads, coordinates, tokens, or scene data.
