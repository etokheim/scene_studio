# Local development

This repo is a Home Assistant custom integration. Python changes only take effect after HA restarts. Day-to-day git is the **`dev`** branch; a PR to `master` is a release ([`docs/GIT.md`](docs/GIT.md), [`RELEASE.md`](RELEASE.md)).

The sandbox is configured in YAML under `dev/config/`:

- `packages/` — extra virtual lights per area ([hass-virtual](https://github.com/twrecked/hass-virtual), old-style YAML)
- `scenes.yaml` — gitignored native scenes for this sandbox (HA writes it back from the UI)
- `area_map.yaml` — area assignment (HA has no YAML for this; applied to the registries after first boot)

Onboarding created the areas **Stue**, **Kjøkken**, and **Soverom**.

## Start

Install hass-virtual into the sandbox (once):

```bash
git clone --depth 1 --branch v0.9.3 https://github.com/twrecked/hass-virtual.git /tmp/hass-virtual
mkdir -p dev/config/custom_components
cp -R /tmp/hass-virtual/custom_components/virtual dev/config/custom_components/virtual
```

```bash
test -f dev/config/scenes.yaml || echo '[]' > dev/config/scenes.yaml
docker compose up -d
```

Open http://localhost:8123 and finish onboarding (once). Then assign lights and scenes to areas:

```bash
docker compose stop
docker compose run --rm --no-deps --entrypoint python3 homeassistant /config/apply_area_map.py
docker compose start
```

After that:

1. **Settings → Devices & services → Add integration → Scene Studio** (once; the form is empty)
2. Open **Scene Studio** in the sidebar
3. Use an area’s plus to **Create scene** or **Create circadian scene**, choosing a library or starter preset when needed
4. Activate the generated `scene.*` with **Developer tools → Actions** (`scene.turn_on`)

Logs: `dev/config/home-assistant.log` or `docker compose logs -f`.

## After code changes

HA does not hot-reload custom component Python. Restart, then test again:

```bash
docker compose restart
```

YAML in `dev/config/` can usually be reloaded from **Developer tools → YAML**. Translation JSON under `custom_components/` still needs a restart. After adding new lights, re-run `apply_area_map.py` with HA stopped.

## Unit tests

Python:

```bash
python3 -m venv .venv
.venv/bin/pip install pytest homeassistant
PYTHONPATH=. .venv/bin/pytest tests/ -q
```

Frontend (no Home Assistant, no browser). CI runs the same command:

```bash
node --test tests/frontend/*.test.mjs
```

The suite also covers revision-aware collaboration, canonical routes, preview cleanup, event inheritance and resets, shared selection, stable strip grouping/painting, and transition interruption. Backend tests cover persistence rollback, migration, lifecycle, permissions, ownership, update policies, and solar limits.

That suite covers wheel grouping (`tests/frontend/pin_groups.test.mjs`), light-tile color groups and modifier selection (`tests/frontend/light_tile_select.test.mjs`), and the simple-scene card dot (`tests/frontend/card_mesh.test.mjs`). Scene icon round-trip is in `tests/test_store_v4.py`. Layout and pointer behavior of the panel are checked in the sandbox with Chrome DevTools MCP. Do not add Playwright. The panel sits in Home Assistant’s shadow DOM behind login; a browser runner would need Docker and sandbox credentials and would not replace these rule tests. See [`docs/DECISIONS.md`](docs/DECISIONS.md) (“Frontend checks are node:test plus the sandbox, not Playwright”).

CI runs the same suite (see `.github/workflows/ci.yml`).

## Stop

```bash
docker compose down
```

Config, onboarding, and your test entities persist in `dev/config/` (runtime files are gitignored).

## Agent REST token (optional)

To let Codex or Cursor agents call the sandbox REST API, create a long-lived token in the sandbox UI (Profile → Long-Lived Access Tokens), copy `dev/config/secrets.yaml.example` to `dev/config/secrets.yaml`, and set `cursor_ha_token`. See [`.agents/skills/home-assistant-api/SKILL.md`](.agents/skills/home-assistant-api/SKILL.md).

## Agent UI login (optional)

Same `secrets.yaml` holds `sandbox_ha_username` and `sandbox_ha_password` for Chrome DevTools MCP against `http://127.0.0.1:8123/scene_studio`. If those keys are missing, agents should ask. Do not commit `secrets.yaml`.

Agent prerequisites and permission troubleshooting: [docs/AGENT_SETUP.md](docs/AGENT_SETUP.md). Panel revision/reload and layout checks: [browser verification skill](.agents/skills/scene-studio-browser-verification/SKILL.md).

## Verification and performance scope

Run the CI checks from the repository environment before delivery:

```bash
.venv/bin/black --check custom_components/scene_studio/ tests/
.venv/bin/isort --check-only custom_components/scene_studio/ tests/
.venv/bin/pylint custom_components/scene_studio/
.venv/bin/python .github/scripts/check_translations.py
```

During development, add copy only to English. Synchronize nb/nn/de/es and write Unreleased notes during release preparation. Open or update a release PR only when requested; do not assign a version or merge it.

Follow the browser verification skill after asset bumps, sandbox restarts, and normal reloads. Wait for the destination editor to finish loading before measuring updates. Restore any sandbox scene edits used for verification with undo or the exact saved snapshot. Record viewport, scene/light counts, DOM mutations, geometry reads, animation work, focus/drag continuity, and scroll retention. Unchanged grouping must produce no structural mutations or layout animation.

The approved performance follow-up and panel split preserve behavior and the existing plain-module loading pattern. See [docs/FRONTEND.md](docs/FRONTEND.md) for module ownership and extraction checks, and [docs/PERFORMANCE.md](docs/PERFORMANCE.md) for measured costs and retained backend safety boundaries. Further optimization needs measurements and unchanged-UI acceptance checks. Keep refactor and performance commits separate; no framework, bundler, or UI rewrite.
