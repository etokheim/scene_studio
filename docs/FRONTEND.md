# Frontend ownership

The panel is still a Home Assistant custom element loaded as plain ES modules.
There is no build step. `panel.js` registers `SceneStudioPanel`, owns its state,
lifecycle and navigation, and mounts the existing editors in the shared shell.

| Module | Responsibility |
| --- | --- |
| `panel_styles.js` | Shadow stylesheet, including component CSS in its original cascade order |
| `panel_constants.js` | Shared timing, geometry and compatibility values |
| `panel_composition.js` | Register explicit method owners, rejecting duplicate names |
| `editor_session.js` | Pure form defaults, dates and clock conversion |
| `editor_history.js` | Snapshots, own-edit undo/redo, gesture boundaries, history targets and collaborative rebasing |
| `panel_catalog.js` | Saved-change subscriptions, catalog reconciliation and revision-aware autosave |
| `panel_dialogs.js` | Supporting pickers, name/metadata dialogs, confirmations, conflicts and location search |
| `location_helpers.js` | Coordinate formatting and comparison |
| `library_editor.js` | Shared Library drafts, loading, editor mounting and starter adoption |
| `preview_controller.js` | Outgoing preview ownership, transitions, request/cache generations, date sampling and temporary light playback/restoration |
| `preview_timeline.js` | Date/location toolbar, timeline orientation/layout and preset/usage controls |
| `circadian_editor.js` | Solar-event editing, field inheritance, shared light selection, graphs and override controls |
| `dial_renderer.js` | Dial construction, retained-frame painting, event anchors and brightness curves |
| `dial_sky.js` | Solar paths, horizon wedges, sun geometry and appearance |
| `dial_interaction.js` | Pointer scrubbing, magnetic snap, sun arcs and event-brightness gestures |
| `dial_light_strip.js` | Dial tile painting, grouping, selection and event actions |
| `dial_svg_frame.js` | Retain painter-owned SVG nodes with unchanged geometry and paint order |

Existing component modules remain real owners: `color_ui.js` owns wheels and
pins; `simple_editor.js` owns ordinary scenes/palettes; `light_tiles.js` owns
shared tiles and strip layout; `landing.js` owns rail/cards and starter previews;
`editor_shell.js` owns the toolbar/preview/light hosts and transition gate;
`client_solar.js`, `dial_clock.js`, `palette.js` and `event_inheritance.js` own
calculation helpers. Routing and collaborative merge helpers remain independent.

## Receiver contract

Extracted method objects use the panel as `this`, just as the original class
methods did. They contain no second copy of editor state and import no panel
class. Their closures call the current panel hooks for navigation, rendering,
saving and membership. This preserves destination-owned handlers, generations,
history and timer cleanup without adding an inheritance chain or UI framework.

`installPanelMethods` installs class-style descriptors before custom-element
registration. It validates every owner before installation and rejects duplicate
methods, including collisions with the panel's own methods. Add a method to one
owner only. Prefer an existing pure helper/component boundary for new code;
do not use the shared receiver as a reason to spread unrelated state between files.

## Verification of a move

Compare moved method bodies with their prior source before changing behavior.
The stylesheet snapshot covers its evaluated rules and ordering. Composition
tests cover identity, receiver binding and ownership; existing behavior tests
continue exercising the same registered panel prototype. Dial frame tests compare
retained geometry with fresh paints through topology, clamp and theme changes.

Bump `PANEL_ASSET_REV` for any frontend module/style change, restart the sandbox,
and normally reload the existing Chrome DevTools page. Check ordinary scenes,
circadian scenes and Library editors, including interrupted navigation and
small/short viewports. No injected code counts as final-source verification.
