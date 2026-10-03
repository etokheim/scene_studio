---
name: scene-studio-browser-verification
description: Verify Scene Studio panel layout and interactions in the local Home Assistant sandbox using official Chrome DevTools MCP. Use after frontend/CSS changes, when diagnosing stale assets, or checking responsive layout, selection, scrolling, and console errors. Not for production HA or pure unit-test-only changes.
---

# Scene Studio browser verification

Use official Chrome DevTools MCP tools exposed by the current host. Tool prefixes vary; discover available tools rather than relying on an old plugin identifier. If disconnected, check the host connection and Chrome session. Do not silently switch to direct Chrome access or another browser runner.

## Load the final source

1. Increment `PANEL_ASSET_REV` in `custom_components/scene_studio/panel.py` for a frontend change set; do not bump the manifest version during development.
2. Restart the local sandbox with `docker compose restart` from the repository root. Wait for Home Assistant startup to finish. Restart needs Docker access; instructions cannot grant it.
3. Reuse the existing Chrome MCP tab for `http://127.0.0.1:8123/scene_studio`. Normally reload the document (`navigate_page` reload without `ignoreCache`). Hash navigation alone keeps registered custom elements stale. Never hard-reload a Cursor-owned HA tab or open one to force fresh assets.
4. If login is required, use only `sandbox_ha_username` and `sandbox_ha_password` from `dev/config/secrets.yaml`. Follow the [API skill](../home-assistant-api/SKILL.md) and [secrets rule](../../../.cursor/rules/secrets-handling.mdc). Do not print credentials; ask if missing or `CHANGEME`.
5. Inspect the network request or resource entry for `/api/scene_studio/assets/<manifest-version>-<PANEL_ASSET_REV>/panel.js`. Compare the loaded revision to source, then confirm a changed DOM/CSS/behavior marker. A fetched source string alone does not prove the registered panel class is current.

## Check the requested behavior

- Pierce Home Assistant's shadow roots to reach `scene-studio-panel`. Inspect computed styles and geometry when a change specifies sizes, gaps, offsets, opacity, or stacking.
- Check normal desktop and wide, short viewports (for example 1440×900 and 1440×600). Add a phone viewport when responsive layout or shared editor chrome is affected. Record actual dimensions; restore the original viewport afterward.
- Exercise affected selection, creation, editing, scrolling, and empty states. Include scene and library views when they share styling. Watch for clipping, duplicate controls, rail jumps, and hidden actions.
- Inspect console errors and relevant failed network requests. Distinguish pre-existing sandbox errors from regressions; do not claim a clean console without checking it.

Temporary in-page CSS or method patches are exploratory previews. Remove them with a normal reload, then verify final source through the revision/restart sequence before reporting it tested. If restart, login, MCP, or revision verification is blocked, report the limitation and checks that ran; do not label a preview as final verification.

## Shared editor regression matrix

For changes touching shared chrome, selection, or preview ownership, include:

- Normal scene, circadian scene, and Library presets: Select all first, total membership count, gray default, and primary wash only when selected. Check deselection restores gray.
- Circadian → circadian → deselect, circadian → normal/Library, and interrupted navigation: one live horizon, no obsolete wheel/sky after exit, retained outgoing pixels until completion, and destination-owned handlers.
- Event selection from tiles/bands/dots; closing the sidebar retains the event, clicking its selected button or changing preview time clears it. Verify blocked light edits and reminder cancellation.
- Final-source card gradients/thumbnails immediately after changing a scene preset, including collaborative refresh. Restore any test edits with undo or the saved snapshot; never leave fixtures silently changed.
- Full-width toolbar and light section; 300px capped preview floor, 24px vertical gaps, dial's 900px cap, and overlap around the 1100px editor-container breakpoint. Timeline follows container aspect ratio and remains within the preview. Sidebar overlays below the app header without resizing preview; overflowing strips can expose the last tile, short strips retain their position.
- Desktop, short desktop, and mobile; date/reset spacing, ordered toolbar wrapping without duplicates, selection scaling rather than hover scaling, and animation interruption/reduced motion where affected.

For strip performance, wait until the destination catalog and preview are ready before collecting a baseline. Measure representative small/large memberships during idle updates and repeated selection/brightness interactions. Record structural mutations, grouping signatures, geometry reads, animations, focus/pointer continuity, node identity, ordering, and scroll position. Unchanged groups must not rebuild or animate. Do not infer live performance from unit tests or a blank/disconnected browser. Broader optimization needs a separate measured report and approved plan.
