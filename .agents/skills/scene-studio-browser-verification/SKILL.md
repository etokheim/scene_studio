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
